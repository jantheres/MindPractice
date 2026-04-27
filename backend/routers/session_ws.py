from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from pydantic import BaseModel
from typing import Dict, Set, List, Callable
import json
import logging
import asyncio
import uuid
from services.transcription_handler import TranscriptionManager
from db.connection import get_db_connection
from routers.soap import generate_soap # Import for automatic triggering

router = APIRouter()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # session_id -> {role -> set(websockets)}
        self.active_sessions: Dict[str, Dict[str, Set[WebSocket]]] = {}
        # session_id -> {role -> TranscriptionManager}
        self.transcribers: Dict[str, Dict[str, TranscriptionManager]] = {}

    async def connect(self, websocket: WebSocket, session_id: str, role: str):
        await websocket.accept()
        if session_id not in self.active_sessions:
            self.active_sessions[session_id] = {"therapist": set(), "client": set()}
            self.transcribers[session_id] = {}
        
        self.active_sessions[session_id][role].add(websocket)
        logger.info(f"New connection: Session {session_id}, Role {role}")

    def disconnect(self, websocket: WebSocket, session_id: str, role: str):
        if session_id in self.active_sessions:
            if websocket in self.active_sessions[session_id][role]:
                self.active_sessions[session_id][role].remove(websocket)
            
            # If no users left in session, cleanup
            all_empty = True
            for r in self.active_sessions[session_id]:
                if self.active_sessions[session_id][r]:
                    all_empty = False
                    break
            
            if all_empty:
                # Cleanup transcriber before deleting session
                if session_id in self.transcribers:
                    for t_role in self.transcribers[session_id]:
                        asyncio.create_task(self.transcribers[session_id][t_role].stop())
                    del self.transcribers[session_id]
                del self.active_sessions[session_id]

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_sessions:
            targets = []
            for role, sockets in self.active_sessions[session_id].items():
                targets.extend(list(sockets))
            
            if targets:
                logger.info(f"Broadcasting to {len(targets)} targets (Therapist: {len(self.active_sessions[session_id]['therapist'])}, Client: {len(self.active_sessions[session_id]['client'])})")
                await asyncio.gather(*[ws.send_json(message) for ws in targets], return_exceptions=True)
            else:
                logger.warning(f"No targets found for broadcast in session {session_id}")

manager = ConnectionManager()

@router.post("/start/{appointment_id}")
async def start_session(appointment_id: str, therapist_id: str, client_id: str):
    """Returns the existing active session or creates a NEW unique session for an appointment."""
    conn = await get_db_connection()
    try:
        appt_uuid = uuid.UUID(appointment_id)
        
        # 1. Check for an EXISTING ACTIVE session only
        # We only want to join if the session hasn't been finalized yet.
        active_session = await conn.fetchrow(
            "SELECT id, status FROM sessions WHERE appointment_id = $1 AND status = 'active' LIMIT 1",
            appt_uuid
        )
        
        if active_session:
            logger.info(f"Joining existing active session {active_session['id']} for appt {appointment_id}")
            return {"session_id": str(active_session['id']), "status": "active"}

        # 2. Create new session if no active session found
        # (This allows starting a new session even if a previous one was completed)
        session_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO sessions (id, appointment_id, therapist_id, client_id, status, started_at)
            VALUES ($1, $2, $3, $4, 'active', NOW())
            """,
            session_id, appt_uuid, uuid.UUID(therapist_id), uuid.UUID(client_id)
        )
        logger.info(f"Created new session {session_id} for appt {appointment_id}")
        return {"session_id": str(session_id), "status": "active"}
    finally:
        await conn.close()

@router.websocket("/ws/{session_id}")
async def session_websocket(
    websocket: WebSocket, 
    session_id: str, 
    role: str = Query("therapist")
):
    await manager.connect(websocket, session_id, role)
    
    # Initialize transcriber for this role in this session if not exists
    if role not in manager.transcribers[session_id]:
        manager.transcribers[session_id][role] = TranscriptionManager(
            session_id=session_id,
            role=role,
            on_transcript=lambda msg: asyncio.create_task(manager.broadcast(session_id, msg))
        )
    
    transcriber = manager.transcribers[session_id][role]
    
    try:
        while True:
            message = await websocket.receive()
            
            if "bytes" in message:
                await transcriber.process_audio(message["bytes"])
                
            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                    if data.get("type") == "control":
                        if data.get("command") == "stop_session":
                            # 1. Update session status in DB
                            conn = await get_db_connection()
                            await conn.execute(
                                "UPDATE sessions SET status = 'completed', ended_at = NOW() WHERE id = $1",
                                uuid.UUID(session_id)
                            )
                            await conn.close()

                            # 2. STOP Transcribers immediately
                            if session_id in manager.transcribers:
                                for t_role in list(manager.transcribers[session_id].keys()):
                                    await manager.transcribers[session_id][t_role].stop()
                                del manager.transcribers[session_id]
                                logger.info(f"Transcribers stopped for session {session_id}")

                            # 3. Trigger SOAP generation
                            try:
                                conn = await get_db_connection()
                                session_record = await conn.fetchrow("SELECT appointment_id FROM sessions WHERE id = $1", uuid.UUID(session_id))
                                appointment_id = session_record['appointment_id']
                                await conn.close()

                                await generate_soap(str(appointment_id), str(session_id))
                                logger.info(f"Auto-generated SOAP for session {session_id}")
                            except Exception as e:
                                logger.error(f"Failed auto-SOAP: {e}")

                            # 4. Notify everyone
                            await manager.broadcast(session_id, {
                                "type": "status",
                                "status": "completed",
                                "message": f"Session ended by {role}"
                            })
                            
                            # 5. Break the loop - this connection is done with session logic
                            break
                except Exception as e:
                    logger.error(f"Control message error: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id, role)
        logger.info(f"Role {role} disconnected from {session_id}")
    except RuntimeError as e:
        if "receive" in str(e):
            # Normal disconnect cleanup
            manager.disconnect(websocket, session_id, role)
            logger.info(f"Role {role} disconnected (receive closed) from {session_id}")
        else:
            logger.error(f"WebSocket Runtime Error for {role} in {session_id}: {e}")
            manager.disconnect(websocket, session_id, role)
    except Exception as e:
        logger.error(f"WebSocket Error for {role} in {session_id}: {e}")
        manager.disconnect(websocket, session_id, role)

class TranscriptUpdate(BaseModel):
    text: str

@router.patch("/transcript/{chunk_id}")
async def update_transcript_chunk(chunk_id: str, data: TranscriptUpdate):
    conn = await get_db_connection()
    try:
        await conn.execute(
            "UPDATE transcript_chunks SET chunk_text = $1 WHERE id = $2",
            data.text, uuid.UUID(chunk_id)
        )
        return {"status": "updated"}
    finally:
        await conn.close()

@router.get("/{session_id}/transcript")
async def get_session_transcript(session_id: str):
    """Fetches the full transcript history for a specific session."""
    conn = await get_db_connection()
    try:
        chunks = await conn.fetch(
            "SELECT id, chunk_text, speaker_role as sender, created_at FROM transcript_chunks WHERE session_id = $1 ORDER BY created_at ASC",
            uuid.UUID(session_id)
        )
        return [
            {
                "id": str(c['id']),
                "sender": c['sender'],
                "text": c['chunk_text'],
                "timestamp": c['created_at'].strftime("%I:%M %p")
            } for c in chunks
        ]
    finally:
        await conn.close()
@router.delete("/{session_id}/transcript")
async def clear_session_transcript(session_id: str):
    conn = await get_db_connection()
    try:
        sess_uuid = uuid.UUID(session_id)
        # 1. Clear Transcript Chunks
        await conn.execute(
            "DELETE FROM transcript_chunks WHERE session_id = $1",
            sess_uuid
        )
        # 2. Clear associated SOAP notes
        await conn.execute(
            "DELETE FROM soap_notes WHERE session_id = $1",
            sess_uuid
        )
        return {"status": "cleared"}
    finally:
        await conn.close()

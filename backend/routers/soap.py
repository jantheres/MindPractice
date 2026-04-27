import os
import json
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from db.connection import get_db_connection
from services.soap_generator import generate_soap_note

router = APIRouter()

class SOAPUpdate(BaseModel):
    subjective: str = None
    objective: str = None
    assessment: str = None
    plan: str = None
    status: str = None # pending, approved, rejected

@router.post("/{appointment_id}/soap/generate")
async def generate_soap(appointment_id: str, session_id: str = None, patient_name: str = "The patient"):
    try:
        appt_uuid = uuid.UUID(appointment_id)
        sess_uuid = uuid.UUID(session_id) if session_id else None
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format.")

    conn = await get_db_connection()
    try:
        # If no session_id provided, find the latest session for this appointment
        if not sess_uuid:
            latest_sess = await conn.fetchrow(
                "SELECT id FROM sessions WHERE appointment_id = $1 ORDER BY started_at DESC LIMIT 1",
                appt_uuid
            )
            if latest_sess:
                sess_uuid = latest_sess['id']

        # Fetch chunks for this specific session
        if sess_uuid:
            chunks = await conn.fetch(
                "SELECT chunk_text FROM transcript_chunks WHERE session_id = $1 ORDER BY created_at ASC",
                sess_uuid
            )
        else:
            # Fallback to appointment_id if no sessions found (legacy)
            chunks = await conn.fetch(
                "SELECT chunk_text FROM transcript_chunks WHERE session_id = $1 ORDER BY created_at ASC",
                appt_uuid
            )
        
        if not chunks:
            return {"status": "skipped", "reason": "No transcript found for this session."}
            
        full_transcript = " ".join([c['chunk_text'] for c in chunks if c['chunk_text']]).strip()
        
        if not full_transcript:
            raise HTTPException(status_code=400, detail="Transcript is empty.")
        
        soap_data = generate_soap_note(full_transcript, patient_name=patient_name)
        
        consent = await conn.fetchrow("SELECT therapist_id FROM consent_log WHERE appointment_id = $1", appt_uuid)
        therapist_id = consent['therapist_id'] if consent else uuid.uuid4()

        # Check if a SOAP note already exists for this session
        existing = await conn.fetchrow("SELECT id FROM soap_notes WHERE session_id = $1", sess_uuid)
        
        if existing:
            # UPDATE existing
            await conn.execute(
                """
                UPDATE soap_notes 
                SET subjective = $1, objective = $2, assessment = $3, plan = $4, raw_transcript = $5, updated_at = NOW()
                WHERE id = $6
                """,
                soap_data['subjective'], soap_data['objective'], 
                soap_data['assessment'], soap_data['plan'], full_transcript,
                existing['id']
            )
            return {"status": "updated", **soap_data}
        else:
            # INSERT new
            await conn.execute(
                """
                INSERT INTO soap_notes (appointment_id, session_id, therapist_id, subjective, objective, assessment, plan, raw_transcript, status, visible_to_client)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', FALSE)
                """,
                appt_uuid, sess_uuid, therapist_id, 
                soap_data['subjective'], soap_data['objective'], 
                soap_data['assessment'], soap_data['plan'], full_transcript
            )
            return {"status": "pending", **soap_data}
    except HTTPException:
        raise
    except Exception as e:
        print(f"SOAP Generation Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
    finally:
        await conn.close()

@router.get("/{appointment_id}/soap")
async def get_soap(appointment_id: str, role: str = "therapist", session_id: str = None):
    conn = await get_db_connection()
    try:
        if session_id:
            record = await conn.fetchrow(
                "SELECT * FROM soap_notes WHERE session_id = $1",
                uuid.UUID(session_id)
            )
        else:
            record = await conn.fetchrow(
                "SELECT * FROM soap_notes WHERE appointment_id = $1 ORDER BY created_at DESC LIMIT 1",
                uuid.UUID(appointment_id)
            )
            
        if not record:
            raise HTTPException(status_code=404, detail="SOAP note not found")
        
        if role == "client" and not record['visible_to_client']:
            return {"status": "pending", "message": "SOAP notes are not yet available"}
            
        return dict(record)
    finally:
        await conn.close()

@router.patch("/{appointment_id}/soap")
async def update_soap(appointment_id: str, data: SOAPUpdate, session_id: str = None):
    conn = await get_db_connection()
    try:
        fields = []
        values = []
        if data.subjective is not None:
            fields.append(f"subjective = ${len(values)+1}")
            values.append(data.subjective)
        if data.objective is not None:
            fields.append(f"objective = ${len(values)+1}")
            values.append(data.objective)
        if data.assessment is not None:
            fields.append(f"assessment = ${len(values)+1}")
            values.append(data.assessment)
        if data.plan is not None:
            fields.append(f"plan = ${len(values)+1}")
            values.append(data.plan)
        if data.status is not None:
            fields.append(f"status = ${len(values)+1}")
            values.append(data.status)
            if data.status == 'approved':
                fields.append(f"visible_to_client = TRUE")
                fields.append(f"approved_at = NOW()")
            elif data.status == 'rejected':
                fields.append(f"visible_to_client = FALSE")
            
        if not fields:
            return {"message": "No fields to update"}
            
        values.append(uuid.UUID(appointment_id))
        app_id_idx = len(values)
        
        query = f"UPDATE soap_notes SET {', '.join(fields)}, updated_at = NOW(), reviewed_at = NOW() WHERE appointment_id = ${app_id_idx}"
        
        if session_id:
            values.append(uuid.UUID(session_id))
            query += f" AND session_id = ${len(values)}"
        else:
            # Fallback to latest for that appointment
            query += f" AND id = (SELECT id FROM soap_notes WHERE appointment_id = ${app_id_idx} ORDER BY created_at DESC LIMIT 1)"
        
        await conn.execute(query, *values)
        return {"status": "updated"}
    finally:
        await conn.close()
from services.soap_validator import validator

@router.post("/{appointment_id}/soap/validate")
async def validate_soap_note(appointment_id: str):
    conn = await get_db_connection()
    try:
        appt_uuid = uuid.UUID(appointment_id)
        
        # 1. Fetch latest SOAP
        soap = await conn.fetchrow(
            "SELECT id, session_id, subjective, objective, assessment, plan FROM soap_notes WHERE appointment_id = $1 ORDER BY created_at DESC LIMIT 1",
            appt_uuid
        )
        if not soap:
            raise HTTPException(status_code=404, detail="SOAP note not found")
        
        # 2. Fetch Transcript Chunks for the same session
        chunks = await conn.fetch(
            "SELECT chunk_text, speaker_role as sender FROM transcript_chunks WHERE session_id = $1 ORDER BY created_at ASC",
            soap['session_id']
        )
        
        if not chunks:
            raise HTTPException(status_code=400, detail="Transcript chunks not found for this session")

        # 3. Validate
        validation_results = await validator.validate_soap(dict(soap), [dict(c) for c in chunks])
        return validation_results
        
    finally:
        await conn.close()

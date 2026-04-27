import os
import uuid
import io
import asyncio
import datetime
import re
import httpx
import time
from google.cloud import speech
from openai import AsyncOpenAI
from db.connection import get_db_connection
from dotenv import load_dotenv

load_dotenv()

# Initialize Fallbacks
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

class TranscriptionManager:
    def __init__(self, session_id: str, role: str, on_transcript: callable):
        self.session_id = session_id
        self.role = role
        self.on_transcript = on_transcript
        
        # PRIORITY: SARVAM AI (Saaras v3)
        self.use_sarvam = True if SARVAM_API_KEY and SARVAM_API_KEY != "your_sarvam_api_key_here" else False
        self.use_whisper = False # Disable whisper to prevent "Thank you for watching" hallucinations

        self.is_running = False
        self._streaming_task = None
        self.header_chunk = None # Store the first chunk (WebM header)
        self.data_chunks = []    # Store subsequent audio chunks
        
        self.current_live_text = ""    # What's currently being "built" live
        self.last_final_transcript = "" # The last finalized full text to prevent re-transcription
        self.total_transcript_history = "" # Cumulative history for delta extraction
        
        self.last_activity_time = 0
        self.session_closed = False 
        self.last_buffer_size = 0
        self.broadcast_log = set() # To prevent identical message re-creation
        self.chunk_count = 0        # Counter for database chunks

        self.hallucinations = [
            "thank you for watching", "subtitles by", "thanks for watching",
            "terima kasih kerana menonton", "please subscribe", "like and subscribe",
            "re-uploaded by", "copyright", "all rights reserved",
            "zimbabwe", "south america", "instagram", "social media", "f1 driver"
        ]

    async def process_audio(self, audio_chunk: bytes):
        if self.session_closed: return

        if not self.is_running:
            self.is_running = True
            self._streaming_task = asyncio.create_task(self._run_transcription_polling())
        
        if self.header_chunk is None:
            self.header_chunk = audio_chunk
        else:
            # Simple Silence Filter: If chunk is extremely small or contains only silence markers (approx)
            # WebM chunks usually have some size, but let's at least check we aren't just buffering air
            if len(audio_chunk) > 10: 
                self.data_chunks.append(audio_chunk)
        
        # Limit buffer to ~2MB
        if len(self.data_chunks) > 200:
            self.data_chunks = self.data_chunks[-100:]

    async def _run_transcription_polling(self):
        last_process_time = time.time()
        
        while True:
            await asyncio.sleep(0.7)
            if not self.is_running or self.session_closed: break
            
            try:
                current_size = len(self.data_chunks)
                growth = current_size - self.last_buffer_size
                
                # Only process if we have significant new audio (avoiding too frequent API calls on silence)
                if growth >= 3 or (growth > 0 and time.time() - last_process_time > 2.5):
                    last_process_time = time.time()
                    self.last_buffer_size = current_size
                    await self._process_sarvam()

                # 🕒 SMART FINALIZATION
                # If we have live text and user paused for > 3.0s
                if self.current_live_text and (time.time() - self.last_activity_time > 3.0):
                    await self._finalize_current_segment()

            except Exception as e:
                print(f"Polling Error: {e}")

    async def _process_sarvam(self):
        try:
            if not self.header_chunk or not self.data_chunks: return

            audio_to_send = self.header_chunk + b"".join(self.data_chunks)
            async with httpx.AsyncClient() as client:
                files = {'file': ('audio.webm', audio_to_send, 'audio/webm')}
                data = {
                    'model': 'saaras:v3',
                    'mode': 'codemix',
                    'language_code': 'ml-IN',
                    'with_timestamps': 'false'
                }
                headers = {'api-subscription-key': SARVAM_API_KEY}
                
                response = await client.post(
                    "https://api.sarvam.ai/speech-to-text",
                    files=files, data=data, headers=headers, timeout=12.0
                )
                
                if response.status_code == 200:
                    transcript = response.json().get('transcript', '').strip()
                    if not transcript: return

                    # Find ONLY the new part relative to what we've ALREADY finalized
                    new_live_part = self._extract_delta(self.last_final_transcript, transcript)
                    
                    if new_live_part and not self._is_hallucination(new_live_part):
                        # Only broadcast if it's different from current live text
                        if new_live_part != self.current_live_text:
                            self.current_live_text = new_live_part
                            self.last_activity_time = time.time()
                            await self._broadcast(new_live_part, False)
                else:
                    print(f"Sarvam Error {response.status_code}")
        except Exception as e:
            print(f"Sarvam Exception: {e}")

    async def _finalize_current_segment(self):
        text_to_finalize = self.current_live_text.strip()
        if not text_to_finalize: return
        
        # Avoid duplicating identical messages
        if text_to_finalize in self.broadcast_log:
            self.current_live_text = ""
            return

        print(f"DEBUG: Finalizing: {text_to_finalize}")
        
        # Update trackers BEFORE DB save to prevent loops on error
        self.last_final_transcript = text_to_finalize
        self.broadcast_log.add(text_to_finalize)
        if len(self.broadcast_log) > 50: 
            self.broadcast_log.clear() 

        self.current_live_text = ""
        self.data_chunks = [] 
        self.last_buffer_size = 0
        self.last_activity_time = time.time()

        # 1. Persist to DB first to get the ID
        chunk_id = None
        try:
            chunk_id = await self._save_to_db(text_to_finalize)
        except Exception as e:
            print(f"CRITICAL: Failed to save chunk to DB: {e}")

        # 2. Broadcast to UI with the ID
        await self._broadcast(text_to_finalize, True, chunk_id)

    def _extract_delta(self, old: str, current: str) -> str:
        """Robustly extracts the new portion of speech."""
        if not old: return current
        # If current is basically a subset or equal to old, return nothing
        if current.lower() in old.lower() or old.lower() in current.lower():
            if len(current) > len(old):
                return current[len(old):].strip()
            return ""
        return current

    def _is_hallucination(self, text: str) -> bool:
        t = text.lower().strip()
        if len(t) < 3: return True # Ignore single words/noises
        
        # Check for banned hallucination words
        for h in self.hallucinations:
            if h in t: return True
        
        # Repetition check (Lower threshold to 2-loops for stability)
        words = re.sub(r'[^\w\s]', '', t).split()
        if len(words) >= 2:
            for n in [1, 2]:
                for i in range(len(words) - n * 1):
                    phrase = " ".join(words[i:i+n])
                    if words.count(phrase) > 2: # If same word/phrase appears 3+ times in one chunk
                        return True
        return False

    async def _broadcast(self, text: str, is_final: bool, chunk_id: str = None):
        await self.on_transcript({
            "type": "transcript",
            "sender": self.role,
            "text": text,
            "is_final": is_final,
            "id": str(chunk_id) if chunk_id else None
        })

    async def _save_to_db(self, text: str):
        conn = await get_db_connection()
        try:
            row = await conn.fetchrow(
                "INSERT INTO transcript_chunks (session_id, speaker_role, chunk_text, chunk_index) VALUES ($1, $2, $3, $4) RETURNING id",
                uuid.UUID(self.session_id), self.role, text, self.chunk_count
            )
            self.chunk_count += 1
            return row['id']
        finally: await conn.close()

    async def stop(self):
        if self.current_live_text: await self._finalize_current_segment()
        self.session_closed = True
        self.is_running = False
        if self._streaming_task: self._streaming_task.cancel()

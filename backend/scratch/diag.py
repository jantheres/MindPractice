import asyncio
import os
from dotenv import load_dotenv
from db.connection import get_db_connection

load_dotenv()

async def check():
    try:
        conn = await get_db_connection()
        print('DB Connection: SUCCESS')
        
        # Check tables
        tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        print('Tables found:', [t['table_name'] for t in tables])
        
        # Check if any data exists in transcript_chunks
        chunks_count = await conn.fetchval("SELECT COUNT(*) FROM transcript_chunks")
        print(f'Transcript chunks count: {chunks_count}')
        
        # Check for the specific appointment used in App.jsx
        appt_id = "550e8400-e29b-41d4-a716-446655440000"
        sessions = await conn.fetch("SELECT id, status FROM sessions WHERE appointment_id = $1", appt_id)
        print(f'Sessions for {appt_id}: {len(sessions)}')
        
        await conn.close()
    except Exception as e:
        print(f'DIAGNOSTIC ERROR: {e}')

if __name__ == "__main__":
    asyncio.run(check())

import asyncio
import sys
from db.connection import get_db_connection

sys.stdout.reconfigure(encoding='utf-8')

async def debug_soap_note():
    conn = await get_db_connection()
    try:
        row = await conn.fetchrow("SELECT * FROM soap_notes ORDER BY created_at DESC LIMIT 1")
        if not row:
            print("No SOAP notes found.")
            return
        
        print(f"ID: {row['id']}")
        print(f"Raw Transcript: {row['raw_transcript']}")
        print(f"Subjective: {row['subjective']}")
        print(f"Objective: {row['objective']}")
        print(f"Status: {row['status']}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(debug_soap_note())

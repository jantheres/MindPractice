import asyncio
import os
import sys

# Add backend to path so we can import db
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import get_db_connection

async def run():
    print("Connecting to DB to add note_type column...")
    conn = await get_db_connection()
    try:
        await conn.execute("ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS note_type VARCHAR(20) DEFAULT 'soap';")
        print("SUCCESS: Column note_type added successfully!")
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())

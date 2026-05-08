import asyncio
import os
import sys

# Add backend to path so we can import db
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import get_db_connection

async def run():
    print("Testing dashboard query...")
    conn = await get_db_connection()
    try:
        rows = await conn.fetch(
            "SELECT id as session_id, appointment_id, started_at, status FROM sessions ORDER BY started_at DESC"
        )
        print(f"SUCCESS: Found {len(rows)} sessions.")
        for row in rows:
            print(f"Session: {row['session_id']}, Status: {row['status']}")
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())

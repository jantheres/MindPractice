import asyncio
import asyncpg

async def migrate():
    conn = await asyncpg.connect("postgresql://postgres:@localhost:5433/mindpractice")
    try:
        await conn.execute("ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;")
        # Also add reviewed_at if it's missing (it was in my previous code)
        await conn.execute("ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;")
        # Add visible_to_client if missing
        await conn.execute("ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN DEFAULT FALSE;")
        # Add session_id if missing
        await conn.execute("ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS session_id UUID;")
        # Add raw_transcript if missing
        await conn.execute("ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS raw_transcript TEXT;")
        # Add status if missing
        await conn.execute("ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';")
        
        print("Migration successful!")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())

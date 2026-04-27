import asyncio
import asyncpg

async def migrate():
    conn = await asyncpg.connect("postgresql://postgres:@localhost:5433/mindpractice")
    try:
        # Drop the unique constraint if it exists
        await conn.execute("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_appointment_id_key;")
        print("Dropped unique constraint on appointment_id.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())

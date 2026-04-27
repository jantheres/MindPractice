import asyncio
import asyncpg
async def check():
    conn = await asyncpg.connect("postgresql://postgres:@localhost:5433/mindpractice")
    try:
        sessions = await conn.fetch("SELECT id, status, started_at FROM sessions ORDER BY started_at DESC LIMIT 5")
        print("LATEST SESSIONS:")
        for s in sessions:
            chunks = await conn.fetchval("SELECT count(*) FROM transcript_chunks WHERE session_id = $1", s['id'])
            print(f"Session {s['id']} | Status: {s['status']} | Chunks: {chunks}")
            
        total_chunks = await conn.fetchval("SELECT count(*) FROM transcript_chunks")
        print(f"\nTotal chunks in DB: {total_chunks}")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(check())

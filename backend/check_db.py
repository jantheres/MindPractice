import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def check_db():
    try:
        url = os.getenv("DATABASE_URL")
        print(f"Connecting to {url}...")
        conn = await asyncpg.connect(url)
        print("Connected!")
        
        tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        print("Tables found:", [t['table_name'] for t in tables])
        
        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())

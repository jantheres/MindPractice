import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    
    if "localhost" in DATABASE_URL or "127.0.0.1" in DATABASE_URL:
        print(f"WARNING: Connecting to a LOCAL database: {DATABASE_URL}")
        
    return await asyncpg.connect(DATABASE_URL)

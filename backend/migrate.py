import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def migrate():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable is not set.")
        return

    print(f"Connecting to database...")
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        print("Connected successfully.")

        schema_path = os.path.join("db", "schema.sql")
        if not os.path.exists(schema_path):
            print(f"ERROR: Schema file not found at {schema_path}")
            await conn.close()
            return

        with open(schema_path, "r") as f:
            schema_sql = f.read()
            
        print("Applying schema...")
        await conn.execute(schema_sql)
        print("Schema applied successfully! All tables created.")
        
        await conn.close()
        print("Connection closed.")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())

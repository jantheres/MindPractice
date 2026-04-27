import asyncio
import asyncpg
import os
from dotenv import load_dotenv

async def setup_db():
    # Try to connect without a password
    user = "postgres"
    host = "localhost"
    port = "5433"
    
    print("Attempting to connect to PostgreSQL...")
    
    try:
        # Connect to default 'postgres' database first
        conn = await asyncpg.connect(user=user, password="", host=host, port=port, database="postgres")
        
        # Create 'mindpractice' database
        try:
            await conn.execute('CREATE DATABASE mindpractice')
            print("Database 'mindpractice' created successfully.")
        except asyncpg.DuplicateDatabaseError:
            print("Database 'mindpractice' already exists.")
        
        await conn.close()

        # Connect to 'mindpractice' and run schema
        conn = await asyncpg.connect(user=user, password="", host=host, port=port, database="mindpractice")
        
        schema_path = os.path.join("db", "schema.sql")
        with open(schema_path, "r") as f:
            schema_sql = f.read()
            
        await conn.execute(schema_sql)
        print("Schema applied successfully.")
        await conn.close()

        # Update .env file
        env_path = ".env"
        new_db_url = f"postgresql://{user}:@localhost:{port}/mindpractice"
        
        with open(env_path, "r") as f:
            lines = f.readlines()
            
        with open(env_path, "w") as f:
            for line in lines:
                if line.startswith("DATABASE_URL="):
                    f.write(f"DATABASE_URL={new_db_url}\n")
                else:
                    f.write(line)
        
        print(f"Updated .env with: {new_db_url}")
        print("\nSUCCESS: Your database is ready!")

    except Exception as e:
        print(f"ERROR: {e}")
        print("\nIt seems there might be a password required or a different port.")

if __name__ == "__main__":
    asyncio.run(setup_db())

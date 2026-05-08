import os
import asyncio
from google import genai
from dotenv import load_dotenv

load_dotenv()

async def run():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found.")
        return
        
    client = genai.Client(api_key=api_key)
    print("Listing available models...")
    try:
        # The new SDK might have a different way to list models
        # Let's try client.models.list()
        for m in client.models.list():
            print(f"Model: {m.name}")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    asyncio.run(run())

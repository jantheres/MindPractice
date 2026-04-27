import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="MindPractice API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "MindPractice Backend API is running"}

# Include routers
from routers import consent, soap, session_ws

app.include_router(consent.router, prefix="/api/session", tags=["consent"])
app.include_router(soap.router, prefix="/api/session", tags=["soap"])
app.include_router(session_ws.router, prefix="/api/session", tags=["session"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

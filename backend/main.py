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
    allow_origins=["*"],  # For production, replace with specific origins
    allow_credentials=False, # Changed to False if origins is '*' to avoid browser blocks
    allow_methods=["*"],
    allow_headers=["*"],
)

import logging
logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global error: {exc}", exc_info=True)
    return {
        "error": "Internal Server Error",
        "message": str(exc),
        "detail": "Check server logs for more information."
    }, 500

# Root endpoint
@app.get("/")
async def root():
    return {"message": "MindPractice Backend API is running"}

@app.post("/api/init-db")
async def init_db():
    """Temporary endpoint to initialize the database schema."""
    from migrate import migrate
    try:
        await migrate()
        return {"status": "success", "message": "Database schema applied successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

# Include routers
from routers import consent, soap, session_ws, dashboard

app.include_router(consent.router, prefix="/api/session", tags=["consent"])
app.include_router(soap.router, prefix="/api/session", tags=["soap"])
app.include_router(session_ws.router, prefix="/api/session", tags=["session"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

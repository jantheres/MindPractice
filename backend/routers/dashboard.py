import os
from fastapi import APIRouter, HTTPException
from db.connection import get_db_connection
from datetime import datetime

router = APIRouter()

@router.get("/sessions")
@router.get("/sessions/")
async def get_dashboard_sessions():
    """
    Fetches all sessions to display on the therapist dashboard.
    """
    print("DEBUG: Dashboard sessions endpoint called!")
    conn = await get_db_connection()

    try:
        # Fetch sessions ordered by most recent
        rows = await conn.fetch(
            "SELECT id as session_id, appointment_id, started_at, status FROM sessions ORDER BY started_at DESC"
        )
        
        sessions = []
        for row in rows:
            # We hardcode the patient name as "Ajay" for now because the current 
            # schema doesn't have a clients/users table with names.
            sessions.append({
                "session_id": str(row['session_id']),
                "appointment_id": str(row['appointment_id']),
                "patient_name": "Ajay", 
                "date": row['started_at'].strftime("%Y-%m-%d %H:%M") if row['started_at'] else "N/A",
                "status": row['status'] or "unknown"
            })
            
        return sessions
    except Exception as e:
        print(f"Error fetching dashboard sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
    finally:
        await conn.close()

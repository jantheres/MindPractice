from fastapi import APIRouter, HTTPException, Request
from db.connection import get_db_connection
from pydantic import BaseModel
from datetime import datetime
import uuid

router = APIRouter()

class ConsentRequest(BaseModel):
    user_type: str # 'therapist' or 'client'
    therapist_id: str

@router.post("/{appointment_id}/consent")
async def log_consent(appointment_id: str, data: ConsentRequest, request: Request):
    print(f"DEBUG: Logging consent for appt: {appointment_id}, type: {data.user_type}")
    conn = await get_db_connection()
    try:
        appt_uuid = uuid.UUID(appointment_id)
        # Check if record exists
        record = await conn.fetchrow(
            "SELECT * FROM consent_log WHERE appointment_id = $1",
            appt_uuid
        )
        
        now = datetime.utcnow()
        ip = request.client.host
        
        if not record:
            print("DEBUG: Creating new consent record")
            if data.user_type == 'therapist':
                await conn.execute(
                    """
                    INSERT INTO consent_log (appointment_id, therapist_id, therapist_consent_at, ip_address)
                    VALUES ($1, $2, $3, $4)
                    """,
                    appt_uuid, uuid.UUID(data.therapist_id), now, ip
                )
            else:
                await conn.execute(
                    """
                    INSERT INTO consent_log (appointment_id, therapist_id, client_consent_at, ip_address)
                    VALUES ($1, $2, $3, $4)
                    """,
                    appt_uuid, uuid.UUID(data.therapist_id), now, ip
                )
        else:
            print("DEBUG: Updating existing consent record")
            if data.user_type == 'therapist':
                await conn.execute(
                    "UPDATE consent_log SET therapist_consent_at = $1 WHERE appointment_id = $2",
                    now, appt_uuid
                )
            else:
                await conn.execute(
                    "UPDATE consent_log SET client_consent_at = $1 WHERE appointment_id = $2",
                    now, appt_uuid
                )
                
        return {"status": "success", "timestamp": now}
    except Exception as e:
        print(f"DEBUG ERROR: Consent failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await conn.close()

@router.get("/{appointment_id}/consent")
async def get_consent(appointment_id: str):
    try:
        appt_uuid = uuid.UUID(appointment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid appointment ID format. Must be a UUID.")

    conn = await get_db_connection()
    try:
        record = await conn.fetchrow(
            "SELECT therapist_consent_at, client_consent_at FROM consent_log WHERE appointment_id = $1",
            appt_uuid
        )
        if not record:
            return {"therapist_consent_at": None, "client_consent_at": None}
        return dict(record)
    finally:
        await conn.close()

import requests
import uuid

APPOINTMENT_ID = "550e8400-e29b-41d4-a716-446655440000"
THERAPIST_ID = "123e4567-e89b-12d3-a456-426614174000"

def test_consent():
    url = f"http://localhost:8000/api/session/{APPOINTMENT_ID}/consent"
    data = {
        "user_type": "therapist",
        "therapist_id": THERAPIST_ID
    }
    try:
        response = requests.post(url, json=data)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_consent()

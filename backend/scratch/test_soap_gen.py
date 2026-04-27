import asyncio
import sys
import json
from services.soap_generator import generate_soap_note

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

def test_soap_generation():
    test_transcript = (
        "THERAPIST: ഹലോ, പണി കുറവുണ്ടോ? "
        "CLIENT: അതെ ഡോക്ടർ, പണി കുറവുണ്ട്. "
        "THERAPIST: നല്ലത്, മരുന്നുകൾ കൃത്യമായി കഴിക്കുക."
    )
    
    print(f"Testing SOAP generation with transcript:\n{test_transcript}\n")
    
    try:
        soap_note = generate_soap_note(test_transcript)
        print("Generated SOAP Note:")
        print(json.dumps(soap_note, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_soap_generation()

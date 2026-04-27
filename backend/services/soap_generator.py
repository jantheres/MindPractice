import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def generate_soap_note(transcript: str, patient_name: str = "The patient") -> dict:
    """
    Takes a full session transcript and generates a structured SOAP note using Gemini.
    SOAP = Subjective, Objective, Assessment, Plan.
    """
    if not transcript or len(transcript.strip()) < 20:
        raise ValueError("Transcript is too short to generate a meaningful SOAP note. Please record a bit more conversation.")

    system_instruction = (
        "You are an expert clinical documentation assistant specializing in multilingual therapy sessions. "
        "The transcript provided is a mix of English and Native Malayalam (Manglish/Codemix). "
        "Your task is to accurately translate and structure this conversation into a professional English SOAP note.\n\n"
        "STRICT GUIDELINES:\n"
        f"1. PATIENT CONTEXT: The patient's name is {patient_name}. Use this name for reference, but DO NOT assume or invent clinical events (e.g., 'presented for consultation', 'greeted warmly') unless they are explicitly reflected in the transcript text.\n"
        "2. FILTER NOISE: Ignore transcription artifacts, repetitive phrases, and hallucinations. If a portion of the transcript is nonsensical, ignore it.\n"
        "3. ACCURACY: Ensure the SOAP note is based ONLY on the evidence in the provided transcript. If the transcript is very brief, the SOAP note should be correspondingly brief.\n"
        "4. LANGUAGE: Extract clinical insights from both English and Malayalam script. Translate all findings into professional clinical English.\n"
        "5. STRUCTURE: Return ONLY a valid JSON object with keys: subjective, objective, assessment, plan. Each value MUST be a simple string."
    )

    prompt = (
        "Generate a professional clinical SOAP note in English from the following session transcript. "
        "Pay close attention to the Malayalam portions to extract symptoms, feelings, or progress reported by the patient.\n\n"
        "TRANSCRIPT:\n"
        f"{transcript}"
    )

    try:
        print(f"DEBUG: Generating SOAP for {patient_name} (Transcript Length: {len(transcript)})")
        response = client.models.generate_content(
            model="gemini-3-flash-preview", 
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json"
            )
        )

        
        # 1. Parse response
        try:
            soap_data = json.loads(response.text)
        except json.JSONDecodeError:
            # Cleanup common Gemini markdown wrapping if it somehow slipped through
            cleaned_text = response.text.replace('```json', '').replace('```', '').strip()
            soap_data = json.loads(cleaned_text)

        print(f"DEBUG: Gemini raw response keys: {list(soap_data.keys())}")

        # 2. Normalize and Extract
        # Handle cases where Gemini nests under a "soap" or "note" key
        if len(soap_data.keys()) == 1 and list(soap_data.keys())[0].lower() in ['soap', 'note', 'soap_note']:
            soap_data = list(soap_data.values())[0]

        # Case-insensitive key mapping
        normalized_data = {k.lower(): v for k, v in soap_data.items()}
        
        # 3. Final validation and mapping to standard keys
        required_keys = ["subjective", "objective", "assessment", "plan"]
        final_soap = {}
        for key in required_keys:
            if key in normalized_data:
                final_soap[key] = str(normalized_data[key])
            else:
                # If missing, try to find a similar key or use empty string
                print(f"WARNING: Key {key} missing in Gemini response. Normalized keys: {list(normalized_data.keys())}")
                # Use fallback text instead of crashing
                final_soap[key] = "Not discussed in this segment."
                
        return final_soap

    except json.JSONDecodeError as e:
        print(f"JSON Parse Error: {e}")
        print(f"Raw Response: {response.text}")
        raise RuntimeError("Failed to parse SOAP note JSON from Gemini response.")
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise RuntimeError(f"Error generating SOAP note: {str(e)}")

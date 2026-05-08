import os
import json
import re
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Lazy client initialization
_client = None

def get_gemini_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables. Please check your .env file.")
        _client = genai.Client(api_key=api_key)
    return _client

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
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json"
            )
        )

        # 1. Parse response
        raw_text = response.text.strip()
        try:
            soap_data = json.loads(raw_text)
        except json.JSONDecodeError:
            # Try to extract JSON from code blocks if present
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                try:
                    soap_data = json.loads(json_match.group(0))
                except:
                    raise ValueError(f"Could not parse extracted JSON: {json_match.group(0)[:100]}...")
            else:
                raise ValueError(f"No JSON found in Gemini response: {raw_text[:100]}...")

        print(f"DEBUG: Gemini raw response keys: {list(soap_data.keys())}")

        # 2. Normalize and Extract
        if len(soap_data.keys()) == 1 and list(soap_data.keys())[0].lower() in ['soap', 'note', 'soap_note']:
            soap_data = list(soap_data.values())[0]

        normalized_data = {k.lower(): v for k, v in soap_data.items()}
        
        required_keys = ["subjective", "objective", "assessment", "plan"]
        final_soap = {}
        for key in required_keys:
            if key in normalized_data:
                final_soap[key] = str(normalized_data[key])
            else:
                print(f"WARNING: Key {key} missing in Gemini response. Normalized keys: {list(normalized_data.keys())}")
                final_soap[key] = "Not discussed in this segment."
                
        return final_soap

    except json.JSONDecodeError as e:
        print(f"JSON Parse Error: {e}")
        print(f"Raw Response: {response.text}")
        raise RuntimeError("Failed to parse SOAP note JSON from Gemini response.")
    except Exception as e:
        print(f"Gemini API Error: {e}")
        raise RuntimeError(f"Error generating SOAP note: {str(e)}")

def generate_dap_note(transcript: str, patient_name: str = "The patient") -> dict:
    """
    Takes a full session transcript and generates a structured DAP note using Gemini.
    DAP = Data, Assessment, Plan.
    """
    if not transcript or len(transcript.strip()) < 20:
        raise ValueError("Transcript is too short to generate a meaningful DAP note.")

    system_instruction = (
        "You are an expert clinical documentation assistant specializing in multilingual therapy sessions. "
        "The transcript provided is a mix of English and Native Malayalam (Manglish/Codemix). "
        "Your task is to accurately translate and structure this conversation into a professional English DAP note.\n\n"
        "STRICT GUIDELINES:\n"
        f"1. PATIENT CONTEXT: The patient's name is {patient_name}. Use this name for reference.\n"
        "2. FILTER NOISE: Ignore transcription artifacts and hallucinations.\n"
        "3. ACCURACY: Ensure the DAP note is based ONLY on the evidence in the provided transcript.\n"
        "4. LANGUAGE: Translate findings from Malayalam into professional clinical English.\n"
        "5. STRUCTURE: Return ONLY a valid JSON object with keys: data, assessment, plan. Each value MUST be a simple string.\n"
        "   - data: Subjective and objective data observed during the session (what the patient said, behavior, reported symptoms).\n"
        "   - assessment: Your professional clinical interpretation of the data (progress, themes, issues).\n"
        "   - plan: The plan for future sessions or interventions."
    )

    prompt = (
        "Generate a professional clinical DAP note in English from the following session transcript.\n\n"
        "TRANSCRIPT:\n"
        f"{transcript}"
    )

    try:
        print(f"DEBUG: Generating DAP for {patient_name}")
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json"
            )
        )

        raw_text = response.text.strip()
        try:
            note_data = json.loads(raw_text)
        except json.JSONDecodeError:
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                try:
                    note_data = json.loads(json_match.group(0))
                except:
                    raise ValueError(f"Could not parse extracted JSON: {json_match.group(0)[:100]}...")
            else:
                raise ValueError(f"No JSON found in Gemini response")

        normalized_data = {k.lower(): v for k, v in note_data.items()}
        
        required_keys = ["data", "assessment", "plan"]
        final_note = {}
        for key in required_keys:
            if key in normalized_data:
                final_note[key] = str(normalized_data[key])
            else:
                final_note[key] = "Not discussed in this segment."
                
        return final_note

    except Exception as e:
        print(f"Gemini API Error (DAP): {e}")
        raise RuntimeError(f"Error generating DAP note: {str(e)}")

def generate_session_summary(transcript: str, patient_name: str = "The patient") -> dict:
    """
    Takes a full session transcript and generates a summary using Gemini.
    """
    if not transcript or len(transcript.strip()) < 20:
        raise ValueError("Transcript is too short to generate a meaningful summary.")

    system_instruction = (
        "You are an expert clinical documentation assistant. "
        "The transcript provided is a mix of English and Native Malayalam (Manglish/Codemix). "
        "Your task is to accurately translate and summarize this conversation in professional English.\n\n"
        "STRICT GUIDELINES:\n"
        "1. STRUCTURE: Return ONLY a valid JSON object with keys: summary, key_issues, progress, risk_alerts, follow_up_plans.\n"
        "   - summary: A concise paragraph summarizing the overall session.\n"
        "   - key_issues: A string listing the main problems or themes discussed.\n"
        "   - progress: A string describing any progress or insights made.\n"
        "   - risk_alerts: A string describing any clinical risks identified (e.g., self-harm, suicidal ideation, severe depression, risk to others) or 'No immediate clinical risks identified' if none.\n"
        "   - follow_up_plans: A string describing recommended follow-up actions or plans for the next session."
    )

    prompt = (
        "Generate a session summary in English from the following session transcript, including risk assessment and follow-up plans.\n\n"
        "TRANSCRIPT:\n"
        f"{transcript}"
    )


    try:
        print(f"DEBUG: Generating Summary for {patient_name}")
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash", 
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json"
            )
        )

        raw_text = response.text.strip()
        try:
            note_data = json.loads(raw_text)
        except json.JSONDecodeError:
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                try:
                    note_data = json.loads(json_match.group(0))
                except:
                    raise ValueError(f"Could not parse extracted JSON")
            else:
                raise ValueError(f"No JSON found in Gemini response")

        normalized_data = {k.lower(): v for k, v in note_data.items()}
        
        required_keys = ["summary", "key_issues", "progress", "risk_alerts", "follow_up_plans"]
        final_note = {}
        for key in required_keys:
            if key in normalized_data:
                final_note[key] = str(normalized_data[key])
            else:
                final_note[key] = "Not discussed in this segment."
                
        return final_note

    except Exception as e:
        print(f"Gemini API Error (Summary): {e}")
        raise RuntimeError(f"Error generating Summary: {str(e)}")

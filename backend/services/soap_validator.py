import os
import json
from google import genai
from google.genai import types
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

class SOAPValidator:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY not found in environment variables.")
            self._client = genai.Client(api_key=api_key)
        return self._client

    async def validate_soap(self, soap_note: Dict[str, str], transcript: List[Dict[str, str]]) -> Dict:
        """
        Validates a SOAP note against the provided transcript.
        Returns citations and a corrected version.
        """
        
        # Format transcript for the prompt
        transcript_text = "\n".join([f"[{m['sender'].upper()}]: {m['text']}" for m in transcript])
        
        prompt = f"""
        You are a meticulous Clinical Documentation Auditor. 
        Your task is to validate a SOAP note against the provided session transcript.
        
        TRANSCRIPT:
        {transcript_text}
        
        SOAP NOTE TO VALIDATE:
        SUBJECTIVE: {soap_note.get('subjective', '')}
        OBJECTIVE: {soap_note.get('objective', '')}
        ASSESSMENT: {soap_note.get('assessment', '')}
        PLAN: {soap_note.get('plan', '')}
        
        INSTRUCTIONS:
        1. For every claim in the SOAP note, find the EXACT line(s) in the transcript that support it.
        2. If a claim is NOT supported or is exaggerated, mark it as "UNSUPPORTED".
        3. Provide a "Verified Version" of the SOAP note that contains ONLY evidence-based information.
        
        OUTPUT FORMAT (JSON ONLY):
        {{
            "validations": {{
                "subjective": [{{ "claim": "...", "status": "supported/unsupported", "citation": "..." }}],
                "objective": [...],
                "assessment": [...],
                "plan": [...]
            }},
            "verified_version": {{
                "subjective": "...",
                "objective": "...",
                "assessment": "...",
                "plan": "..."
            }},
            "overall_accuracy_score": 0-100
        }}
        """

        try:
            client = self._get_client()
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            
            # Handle potential markdown wrapping
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:-3]
            elif text.startswith("```"):
                text = text[3:-3]
            
            return json.loads(text)
        except Exception as e:
            print(f"Validation Error: {e}")
            return {
                "error": str(e),
                "validations": {},
                "verified_version": soap_note,
                "overall_accuracy_score": 0
            }

validator = SOAPValidator()

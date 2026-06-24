import os
import json

def analyze_disaster_impact(incident_name: str, category: str, change_percentage: float, bounding_boxes: list):
    """
    Coordinates with Gemini 2.5 Flash to analyze multi-spectral metrics and return custom JSON guides.
    If Gemini API key is missing or the request times out, it gracefully downgrades to a deterministic, Rule-Based Triage engine.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY missing. Activating deterministic tactical fallback guides.")
        return get_fallback_guidance(category, change_percentage, bounding_boxes)
        
    try:
        from google import genai
        from google.genai import types
        
        # Initialize official Google GenAI Client
        client = genai.Client(api_key=api_key)
        
        system_instruction = (
            "You are VyomOps AI, an automated satellite-driven disaster assessment coordinator tracking physical multi-temporal visual changes. "
            "Analyze the detected incident, evaluate risk, select severity, and provide a field-ready checklist."
        )
        
        user_prompt = (
            f"Analyze current incident metadata:\n"
            f"- Incident Name: {incident_name}\n"
            f"- Category: {category}\n"
            f"- Change Delta Percentage: {change_percentage}%\n"
            f"- Quantized Bounding Boxes: {json.dumps(bounding_boxes)}\n\n"
            f"Provide a structured assessment based on localized geographic and physical impacts."
        )
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "risk_score": types.Schema(type=types.Type.INTEGER, description="A value from 1 to 10 evaluating damage hazard"),
                        "severity": types.Schema(type=types.Type.STRING, description="Must be one of: Critical, Active, or Cleared"),
                        "checklist": types.Schema(
                            type=types.Type.ARRAY,
                            items=types.Schema(type=types.Type.STRING),
                            description="Array of 3-5 tactical physical steps for ground alignment"
                        )
                    },
                    required=["risk_score", "severity", "checklist"]
                )
            )
        )
        
        # Parse output safely
        if response.text:
            return json.loads(response.text)
        
    except Exception as e:
        print(f"Gemini analysis gateway error: {e}. Securing fallback.")
        
    return get_fallback_guidance(category, change_percentage, bounding_boxes)

def get_fallback_guidance(category: str, change_percentage: float, bounding_boxes: list):
    """
    Rule-based failover triage module calculating accurate threat scores and guidelines based on physical change criteria.
    """
    checklist = [
        "Inspect visual discrepancy zones for active fire or flooding boundaries",
        "Coordinate immediate scout drone surveys over isolated target blocks",
        "Check local GIS weather databases for concurrent atmospheric warnings"
    ]
    
    risk_score = 3
    severity = "Cleared"
    
    # Calculate risks based on category and raw pixel change
    if change_percentage >= 20.0:
        risk_score = 9
        severity = "Critical"
        checklist.insert(0, f"EMERGENCY PRIORITY: Initiate local evacuations within the detected coordinate rings.")
    elif change_percentage >= 8.0:
        risk_score = 7
        severity = "Active"
        checklist.insert(0, f"TACTICAL FOCUS: Mobilize primary emergency response operators and block hazardous perimeter points.")
    else:
        risk_score = 4
        severity = "Active"
        checklist.insert(0, f"OBSERVATION STATUS: Maintain regular hourly satellite feeds to ensure zero subsequent anomalies.")
        
    return {
        "risk_score": risk_score,
        "severity": severity,
        "checklist": checklist
    }

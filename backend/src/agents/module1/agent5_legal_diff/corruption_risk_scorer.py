import os
import json
import google.generativeai as genai
from typing import List, Dict, Any

def score_corruption_risk(flagged_pairs: List[Dict[str, Any]], days_before_deadline: int) -> Dict[str, Any]:
    """
    Sub-Agent 5.3: Corruption Risk Scorer
    Uses Gemini to classify the type of change and applies a mathematical
    temporal multiplier based on when the change was made relative to the deadline.
    """
    if not flagged_pairs:
        return {
            "overall_manipulation_probability": 0.0,
            "risk_level": "SAFE",
            "flagged_clauses": [],
            "days_before_deadline": days_before_deadline,
            "temporal_multiplier": 1.0
        }

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment.")
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    # 1. TEMPORAL MULTIPLIER MATH
    temporal_multiplier = 1.0
    if days_before_deadline <= 2:
        temporal_multiplier = 3.0  # Last-minute changes are highly suspicious
    elif days_before_deadline <= 7:
        temporal_multiplier = 1.5

    scored_clauses = []
    total_restriction_score = 0.0

    # 2. GEMINI CLASSIFICATION FOR EACH FLAG
    for pair in flagged_pairs:
        prompt = f"""
        You are a legal procurement AI auditor. Compare these two clauses from a government tender.
        Original: "{pair['original_clause']}"
        Amended: "{pair['amended_clause']}"

        Classify the change as EXACTLY ONE of the following:
        - "RESTRICTIVE" (The amendment makes it harder for MSMEs to bid, e.g., increased EMD, higher turnover, stricter experience).
        - "PERMISSIVE" (The amendment makes it easier, e.g., lowered requirements).
        - "NEUTRAL" (Clarifications, spelling fixes, unrelated changes).
        
        Output valid JSON exactly like this:
        {{"classification": "RESTRICTIVE", "reason": "brief explanation"}}
        """
        
        try:
            response = model.generate_content(prompt)
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].strip()
                
            data = json.loads(text)
            classification = data.get("classification", "NEUTRAL").upper()
            reason = data.get("reason", "")
            
            # Map classification to base score
            base_score = 0.0
            if classification == "RESTRICTIVE":
                base_score = 0.3 # Base restriction score per clause
            elif classification == "NEUTRAL":
                base_score = 0.1
                
            total_restriction_score += base_score
            
            scored_clause = pair.copy()
            scored_clause["classification"] = classification
            scored_clause["reason"] = reason
            scored_clause["base_risk_score"] = base_score
            scored_clauses.append(scored_clause)
            
        except Exception as e:
            print(f"[Error in Risk Scorer] {e}")
            scored_clauses.append({**pair, "classification": "ERROR", "reason": "AI failed to classify", "base_risk_score": 0.0})

    # 3. FINAL MATH
    # Max restriction score capped before multiplier
    capped_restriction = min(total_restriction_score, 1.0)
    
    # Final manipulation probability (capped at 0.99 for realistic bounds)
    final_prob = min(capped_restriction * temporal_multiplier, 0.99)
    
    risk_level = "SAFE"
    if final_prob >= 0.75:
        risk_level = "CRITICAL"
    elif final_prob >= 0.40:
        risk_level = "SUSPICIOUS"

    return {
        "overall_manipulation_probability": round(final_prob, 2),
        "risk_level": risk_level,
        "flagged_clauses": scored_clauses,
        "days_before_deadline": days_before_deadline,
        "temporal_multiplier": temporal_multiplier
    }

import json
import os
from typing import List, Dict, Any

def load_json(filepath: str) -> List[Dict[str, Any]]:
    with open(filepath, 'r') as f:
        return json.load(f)

# Load databases globally for the agent
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))), "test_data", "databases")
MSME_DB_PATH = os.path.join(DB_DIR, "msme_database.json")
TENDER_DB_PATH = os.path.join(DB_DIR, "tender_database.json")

def evaluate_solo_match(msme: Dict[str, Any], tender: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates if a single MSME can win a tender on its own.
    Returns a score and detailed breakdown of constraints.
    """
    score = 0
    max_score = 100
    missing_requirements = []
    
    # 1. Sector Check (Hard Requirement)
    if msme['sector'] != tender['category']:
        return {
            "is_eligible": False, 
            "score": 0, 
            "reason": f"Sector mismatch (MSME: {msme['sector']} vs Tender: {tender['category']})", 
            "missing_requirements": [f"Sector mismatch (MSME is {msme['sector']}, Tender is {tender['category']})"],
            "tender": tender
        }
        
    score += 25
    
    # Check for Startup Exemptions
    is_exempt = tender['allows_startup_exemption'] and msme.get('is_startup_india_recognized', False)
    
    # 2. Turnover Check
    if is_exempt or msme['annual_turnover_lakhs'] >= tender['min_turnover_lakhs']:
        score += 35
    else:
        missing_requirements.append(f"Turnover (Has {msme['annual_turnover_lakhs']}L, Needs {tender['min_turnover_lakhs']}L)")
        
    # 3. Experience Check
    if is_exempt or msme['years_of_experience'] >= tender['min_experience_years']:
        score += 20
    else:
        missing_requirements.append(f"Experience (Has {msme['years_of_experience']}Y, Needs {tender['min_experience_years']}Y)")
        
    # 4. Certifications Check
    missing_certs = [cert for cert in tender['required_certifications'] if cert not in msme['certifications']]
    if not missing_certs:
        score += 20
    else:
        missing_requirements.append(f"Certifications (Missing {', '.join(missing_certs)})")
        
    is_eligible = len(missing_requirements) == 0
    
    # If exempt, guarantee 100% eligibility score.
    if is_eligible and is_exempt:
        score = 100
        
    return {
        "is_eligible": is_eligible,
        "score": score,
        "missing_requirements": missing_requirements,
        "tender": tender
    }

def find_solo_opportunities(msme_id: str) -> Dict[str, Any]:
    """
    Phase 1: The Solo Matchmaker.
    Scans the database and finds all tenders the MSME can win alone.
    """
    msmes = load_json(MSME_DB_PATH)
    tenders = load_json(TENDER_DB_PATH)
    
    # Find the specific MSME
    msme_profile = next((m for m in msmes if m['msme_id'] == msme_id), None)
    if not msme_profile:
        raise ValueError(f"MSME ID {msme_id} not found in database.")
        
    eligible_tenders = []
    failed_tenders = []
    
    for tender in tenders:
        result = evaluate_solo_match(msme_profile, tender)
        if result["is_eligible"]:
            eligible_tenders.append(result)
        else:
            failed_tenders.append(result)
            
    # Sort eligible tenders by score (descending)
    eligible_tenders.sort(key=lambda x: x["score"], reverse=True)
    
    return {
        "msme": msme_profile,
        "total_eligible": len(eligible_tenders),
        "eligible_tenders": eligible_tenders,
        "failed_tenders": failed_tenders
    }

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    # Test script for M101
    print("Running Matchmaker for M101 (TechSolve Solutions - 25L Turnover, Startup)...")
    results = find_solo_opportunities("M101")
    
    print(f"\n✅ ELIGIBLE TENDERS ({results['total_eligible']}):")
    for match in results['eligible_tenders']:
        print(f" - {match['tender']['tender_id']} | Score: {match['score']}% | {match['tender']['title']}")
        
    print(f"\n❌ FAILED TENDERS ({len(results['failed_tenders'])}):")
    for match in results['failed_tenders']:
        print(f" - {match['tender']['tender_id']} | Reason: {', '.join(match['missing_requirements']) if match.get('missing_requirements') else match.get('reason')}")

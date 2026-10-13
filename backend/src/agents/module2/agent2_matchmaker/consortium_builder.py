import json
import os
from typing import List, Dict, Any

def load_json(filepath: str) -> List[Dict[str, Any]]:
    with open(filepath, 'r') as f:
        return json.load(f)

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))), "test_data", "databases")
MSME_DB_PATH = os.path.join(DB_DIR, "msme_database.json")
TENDER_DB_PATH = os.path.join(DB_DIR, "tender_database.json")

def find_jv_partner(primary_msme: Dict[str, Any], tender: Dict[str, Any], all_msmes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Phase 2: Consortium Builder Algorithm
    Finds a complementary MSME to form a Joint Venture if the primary MSME fails solo criteria.
    """
    # If the primary MSME is already in a different sector, a JV won't fix it (hard requirement)
    if primary_msme['sector'] != tender['category']:
        return None

    # Calculate what the primary MSME is missing
    missing_turnover = max(0, tender['min_turnover_lakhs'] - primary_msme['annual_turnover_lakhs'])
    missing_certs = [cert for cert in tender['required_certifications'] if cert not in primary_msme['certifications']]
    
    # We won't combine experience in this simple model (must be met by at least one partner)
    needs_experience = primary_msme['years_of_experience'] < tender['min_experience_years']

    potential_partners = []

    for partner in all_msmes:
        # Don't partner with yourself
        if partner['msme_id'] == primary_msme['msme_id']:
            continue
            
        # Sector must match
        if partner['sector'] != tender['category']:
            continue

        # Does this partner fill the gaps?
        fills_turnover = partner['annual_turnover_lakhs'] >= missing_turnover
        fills_certs = all(cert in partner['certifications'] for cert in missing_certs)
        fills_experience = not needs_experience or partner['years_of_experience'] >= tender['min_experience_years']

        if fills_turnover and fills_certs and fills_experience:
            potential_partners.append({
                "partner_id": partner['msme_id'],
                "partner_name": partner['company_name'],
                "combined_turnover": primary_msme['annual_turnover_lakhs'] + partner['annual_turnover_lakhs'],
                "match_score": 95 # High score for successfully bridging the gap
            })

    # Return the best partner (highest turnover contribution as a tiebreaker)
    if potential_partners:
        potential_partners.sort(key=lambda x: x['combined_turnover'], reverse=True)
        return potential_partners[0]
        
    return None

def analyze_jv_opportunities(msme_id: str) -> List[Dict[str, Any]]:
    """
    Finds all tenders that the MSME CANNOT win alone, but CAN win if they form a JV.
    """
    msmes = None
    tenders = None
    try:
        from src.db.database import SessionLocal
        from src.db.models import MSMEModel, TenderModel
        db = SessionLocal()
        db_msmes = db.query(MSMEModel).all()
        db_tenders = db.query(TenderModel).all()
        if db_msmes and db_tenders:
            msmes = [m.to_dict() for m in db_msmes]
            tenders = [t.to_dict() for t in db_tenders]
        db.close()
    except Exception:
        pass

    if not msmes or not tenders:
        msmes = load_json(MSME_DB_PATH)
        tenders = load_json(TENDER_DB_PATH)
    
    primary_msme = next((m for m in msmes if m['msme_id'] == msme_id), None)
    if not primary_msme:
        raise ValueError(f"MSME ID {msme_id} not found.")

    jv_opportunities = []

    for tender in tenders:
        # First, check if they fail solo (no need for JV if they win alone)
        is_exempt = tender['allows_startup_exemption'] and primary_msme.get('is_startup_india_recognized', False)
        
        has_turnover = primary_msme['annual_turnover_lakhs'] >= tender['min_turnover_lakhs']
        has_experience = primary_msme['years_of_experience'] >= tender['min_experience_years']
        has_certs = all(cert in primary_msme['certifications'] for cert in tender['required_certifications'])
        
        if is_exempt or (has_turnover and has_experience and has_certs):
            continue # They can win solo!

        # Try to find a partner
        best_partner = find_jv_partner(primary_msme, tender, msmes)
        if best_partner:
            jv_opportunities.append({
                "tender": tender,
                "recommended_partner": best_partner
            })

    return jv_opportunities

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    
    # Test script for M101 (25L Turnover). Needs help for T2002 (50L, ISO 9001)
    print("Running Consortium Builder for M101...")
    results = analyze_jv_opportunities("M101")
    
    print(f"\n🤝 JOINT VENTURE OPPORTUNITIES ({len(results)}):")
    for opp in results:
        t = opp['tender']
        p = opp['recommended_partner']
        print(f" - Tender: {t['title']} (Needs {t['min_turnover_lakhs']}L)")
        print(f"   Action: Partner with {p['partner_name']} (Combined Turnover: {p['combined_turnover']}L)")

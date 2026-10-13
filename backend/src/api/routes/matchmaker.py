from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from src.agents.module2.agent2_matchmaker.matchmaker import find_solo_opportunities
from src.agents.module2.agent2_matchmaker.consortium_builder import analyze_jv_opportunities

router = APIRouter(prefix="/api/matchmaker", tags=["Matchmaker & Consortium"])

@router.get("/{msme_id}", response_model=Dict[str, Any])
async def get_matchmaker_dashboard(msme_id: str):
    """
    Module 2 Phase 3: The Matchmaker API
    Returns a unified dashboard combining Solo Opportunities and Joint Venture Recommendations.
    """
    try:
        # Phase 1: Get Solo Tenders
        solo_data = find_solo_opportunities(msme_id)
        
        # Phase 2: Get Consortium (JV) Tenders
        jv_data = analyze_jv_opportunities(msme_id)
        
        # Combine them into a single payload for the Next.js Frontend
        dashboard_payload = {
            "msme_profile": solo_data["msme"],
            "solo_opportunities": {
                "count": solo_data["total_eligible"],
                "tenders": solo_data["eligible_tenders"]
            },
            "joint_venture_opportunities": {
                "count": len(jv_data),
                "tenders": jv_data
            },
            "missed_opportunities": {
                "count": len(solo_data["failed_tenders"]) - len(jv_data), 
                # (Total failed minus the ones we salvaged with JVs)
                "tenders": solo_data["failed_tenders"]
            }
        }
        
        return dashboard_payload
        
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Matchmaker Error: {str(e)}")

from typing import TypedDict, List, Dict, Any, Optional

class ProcurementCopilotState(TypedDict):
    """
    State definition for the LangGraph Neurosymbolic Pipeline.
    Passed between all 6 core orchestration nodes.
    """
    file_path: str
    profile: Dict[str, Any]
    target_language: str
    
    # Sub-Agent 1.1 output
    raw_pdf_text: str
    
    # Sub-Agent 1.2 output
    retrieved_context: str
    
    # Sub-Agent 1.3 output
    extracted_rules: Optional[Dict[str, Any]]
    
    # Sub-Agent 1.4, 1.5, 1.6, 1.8 output
    verification_report: Optional[Dict[str, Any]]
    
    # Sub-Agent 1.7 output
    plain_summary: str
    regional_summary: str
    
    # Sub-Agent 1.9 output
    recommended_schemes: List[str]
    
    # System logs / errors
    logs: List[str]
    error: Optional[str]

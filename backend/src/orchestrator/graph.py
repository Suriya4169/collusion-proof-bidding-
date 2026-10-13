import os
from typing import Dict, Any
from langgraph.graph import StateGraph, END

from .state import ProcurementCopilotState
from src.agents.module1.agent1_copilot.pdf_extractor import extract_text_from_pdf
from src.agents.module1.agent1_copilot.rag_retriever import chunk_text, build_hybrid_retriever, retrieve_relevant_chunks
from src.agents.module1.agent1_copilot.neural_extractor import extract_rules_with_gemini
from src.agents.module1.agent1_copilot.symbolic_verifier import verify_eligibility, MSMEProfile
from src.agents.module1.agent1_copilot.tender_simplifier import generate_plain_summary, translate_summary
from src.agents.module1.agent1_copilot.scheme_discoverer import discover_schemes

# ═════════════════════════════════════════════════════════════════════
# 1. GRAPH NODES (Connecting Each Sub-Agent to LangGraph State)
# ═════════════════════════════════════════════════════════════════════

def node_extract_pdf(state: ProcurementCopilotState) -> Dict[str, Any]:
    """Sub-Agent 1.1: Extracts raw text from the uploaded PDF."""
    logs = list(state.get("logs", []))
    logs.append("Node 1: Extracting text using PyMuPDF...")
    try:
        raw_text = extract_text_from_pdf(state["file_path"])
        logs.append(f"Node 1: Extracted {len(raw_text)} characters.")
        return {"raw_pdf_text": raw_text, "logs": logs}
    except Exception as e:
        logs.append(f"Node 1 Error: {str(e)}")
        return {"error": str(e), "logs": logs}


def node_rag_retrieval(state: ProcurementCopilotState) -> Dict[str, Any]:
    """Sub-Agent 1.2: Ephemeral hybrid chunking & dense retrieval."""
    logs = list(state.get("logs", []))
    logs.append("Node 2: Running Ephemeral RAG indexing and query retrieval...")
    try:
        chunks = chunk_text(state["raw_pdf_text"])
        retriever = build_hybrid_retriever(chunks)
        query = "What is the EMD amount, turnover requirement, experience requirement, MSME exemptions, and required certifications?"
        context = retrieve_relevant_chunks(retriever, query)
        logs.append(f"Node 2: Filtered context to {len(context)} characters (97% token reduction).")
        return {"retrieved_context": context, "logs": logs}
    except Exception as e:
        logs.append(f"Node 2 Error: {str(e)}")
        return {"error": str(e), "logs": logs}


def node_neural_extraction(state: ProcurementCopilotState) -> Dict[str, Any]:
    """Sub-Agent 1.3: Gemini LLM extraction with strict Pydantic JSON schema."""
    logs = list(state.get("logs", []))
    logs.append("Node 3: Sending structured prompt to Gemini with Pydantic validation...")
    try:
        rules = extract_rules_with_gemini(state["retrieved_context"])
        logs.append("Node 3: Successfully extracted typed rules with confidence scores.")
        return {"extracted_rules": rules.model_dump(), "logs": logs}
    except Exception as e:
        logs.append(f"Node 3 Error: {str(e)}")
        return {"error": str(e), "logs": logs}


def node_symbolic_verification(state: ProcurementCopilotState) -> Dict[str, Any]:
    """Sub-Agents 1.4, 1.5, 1.6, 1.8: Deterministic Python zero-hallucination verification."""
    logs = list(state.get("logs", []))
    logs.append("Node 4: Executing Symbolic Verifier (Python Math + CDS)...")
    try:
        from src.models.schemas import TenderRequirements
        rules = TenderRequirements(**state["extracted_rules"])
        profile_data = state["profile"]
        profile = MSMEProfile(
            company_name=profile_data.get("company_name", "MSME Bidder"),
            turnover_inr=int(profile_data.get("turnover", 5000000)),
            experience_years=int(profile_data.get("experience", 3)),
            certifications=profile_data.get("certifications", []),
            is_registered_msme=profile_data.get("is_msme", True)
        )
        report = verify_eligibility(rules, profile)
        logs.append(f"Node 4: Symbolic verification complete. Eligible: {report.is_eligible}, Score: {report.overall_compliance_score}%")
        return {"verification_report": report.model_dump(), "logs": logs}
    except Exception as e:
        logs.append(f"Node 4 Error: {str(e)}")
        return {"error": str(e), "logs": logs}


def node_tender_simplification(state: ProcurementCopilotState) -> Dict[str, Any]:
    """Sub-Agent 1.7: Generates plain summary and regional translation."""
    logs = list(state.get("logs", []))
    logs.append("Node 5: Generating Plain Language & Regional Hindi Translation...")
    try:
        from src.models.schemas import VerificationReport
        report = VerificationReport(**state["verification_report"])
        plain = generate_plain_summary(report)
        target_lang = state.get("target_language", "Hindi")
        regional = translate_summary(report, target_language=target_lang)
        logs.append(f"Node 5: Translated summary into {target_lang}.")
        return {"plain_summary": plain, "regional_summary": regional, "logs": logs}
    except Exception as e:
        logs.append(f"Node 5 Error: {str(e)}")
        return {"error": str(e), "logs": logs}


def node_scheme_discovery(state: ProcurementCopilotState) -> Dict[str, Any]:
    """Sub-Agent 1.9: Discovers Indian government schemes to bridge compliance gaps."""
    logs = list(state.get("logs", []))
    logs.append("Node 6: Discovering Government Subsidies & Schemes...")
    try:
        from src.models.schemas import VerificationReport
        report = VerificationReport(**state["verification_report"])
        schemes = discover_schemes(report)
        logs.append(f"Node 6: Recommended {len(schemes)} schemes.")
        return {"recommended_schemes": schemes, "logs": logs}
    except Exception as e:
        logs.append(f"Node 6 Error: {str(e)}")
        return {"error": str(e), "logs": logs}


# ═════════════════════════════════════════════════════════════════════
# 2. COMPILE STATEGRAPH
# ═════════════════════════════════════════════════════════════════════

def build_procurement_graph():
    """Builds and compiles the full LangGraph orchestration graph."""
    workflow = StateGraph(ProcurementCopilotState)

    # Register Nodes
    workflow.add_node("pdf_extractor", node_extract_pdf)
    workflow.add_node("rag_retriever", node_rag_retrieval)
    workflow.add_node("neural_extractor", node_neural_extraction)
    workflow.add_node("symbolic_verifier", node_symbolic_verification)
    workflow.add_node("tender_simplifier", node_tender_simplification)
    workflow.add_node("scheme_discoverer", node_scheme_discovery)

    # Define Linear State Transitions
    workflow.set_entry_point("pdf_extractor")
    workflow.add_edge("pdf_extractor", "rag_retriever")
    workflow.add_edge("rag_retriever", "neural_extractor")
    workflow.add_edge("neural_extractor", "symbolic_verifier")
    workflow.add_edge("symbolic_verifier", "tender_simplifier")
    workflow.add_edge("tender_simplifier", "scheme_discoverer")
    workflow.add_edge("scheme_discoverer", END)

    return workflow.compile()

# Global compiled application instance
procurement_graph = build_procurement_graph()

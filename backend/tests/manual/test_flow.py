"""
═══════════════════════════════════════════════════════════
  AGENT 1: MSME Compliance Copilot — Full Pipeline Test
  Sub-Agents 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8
═══════════════════════════════════════════════════════════
"""
import os
import sys
import json
from dotenv import load_dotenv

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

from src.agents.nlp_copilot.pdf_extractor import extract_text_from_pdf
from src.agents.nlp_copilot.rag_retriever import chunk_text, build_hybrid_retriever, retrieve_relevant_chunks
from src.agents.nlp_copilot.neural_extractor import extract_rules_with_gemini
from src.agents.nlp_copilot.symbolic_verifier import verify_eligibility
from src.agents.nlp_copilot.tender_simplifier import simplify_to_hindi, generate_plain_summary
from src.agents.nlp_copilot.scheme_discoverer import discover_schemes
from src.agents.nlp_copilot.payment_tracker import calculate_payment_penalty
from src.models.schemas import MSMEProfile


def test_full_pipeline():
    pdf_path = r"d:\Final_year_Project\backend\test_data\GeM-Bidding-9292805.pdf"
    
    print("=" * 60)
    print("  AGENT 1: MSME COMPLIANCE COPILOT — FULL PIPELINE")
    print("  Sub-Agents: 1.1 → 1.2 → 1.3/1.5 → 1.4/1.6/1.8 → 1.7")
    print("=" * 60)
    
    # ─── Sub-Agent 1.1: PDF Extractor ───
    print("\n[Sub-Agent 1.1] 📄 Extracting text from PDF...")
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
    raw_text = extract_text_from_pdf(pdf_bytes)
    print(f"  ✅ Extracted {len(raw_text)} characters from PDF")
    
    # ─── Sub-Agent 1.2: RAG Retriever ───
    print("\n[Sub-Agent 1.2] 🔍 Chunking and building retriever...")
    chunks = chunk_text(raw_text)
    retriever = build_hybrid_retriever(chunks)
    
    query = "What is the EMD amount, turnover requirement, experience requirement, MSME exemptions, and required certifications?"
    print(f"  Query: '{query}'")
    relevant_text = retrieve_relevant_chunks(retriever, query)
    print(f"  ✅ Retrieved {len(relevant_text)} characters of relevant context")
    
    # ─── Sub-Agent 1.3 + 1.5: Neural Extractor with Confidence Scoring ───
    print("\n[Sub-Agent 1.3 + 1.5] 🧠 Extracting rules with Gemini (+ Confidence Scores)...")
    rules = extract_rules_with_gemini(relevant_text)
    
    print("\n  ╔══════════════════════════════════════════╗")
    print("  ║   NEURAL EXTRACTION + CONFIDENCE OUTPUT  ║")
    print("  ╚══════════════════════════════════════════╝")
    print(rules.model_dump_json(indent=2))
    
    # ─── Sub-Agent 1.4 + 1.6 + 1.8: Symbolic Verifier + CDS + Document Check ───
    print("\n[Sub-Agent 1.4 + 1.6 + 1.8] ⚖️ Running Symbolic Verification...")
    
    # Test MSME Profile: Small company, registered MSME, missing some certs
    test_msme = MSMEProfile(
        company_name="Bharat Precision Engineering Pvt Ltd",
        turnover_inr=4850000,      # ₹48.5 Lakhs
        experience_years=5,         # 5 years
        certifications=["Udyam"],   # Has Udyam, but might be missing others
        is_registered_msme=True     # Registered MSME → triggers exemptions
    )
    
    print(f"\n  Testing Profile:")
    print(f"    Company:    {test_msme.company_name}")
    print(f"    Turnover:   ₹{test_msme.turnover_inr:,}")
    print(f"    Experience: {test_msme.experience_years} years")
    print(f"    Certs:      {test_msme.certifications}")
    print(f"    MSME:       {'Yes ✅' if test_msme.is_registered_msme else 'No ❌'}")
    
    report = verify_eligibility(rules, test_msme)
    
    print("\n  ╔══════════════════════════════════════════╗")
    print("  ║   VERIFICATION REPORT (with CDS scores) ║")
    print("  ╚══════════════════════════════════════════╝")
    
    # Print the verdict
    verdict = "✅ ELIGIBLE" if report.is_eligible else "❌ NOT ELIGIBLE"
    print(f"\n  🎯 OVERALL VERDICT: {verdict}")
    print(f"  📊 Compliance Score: {report.overall_compliance_score}%")
    
    # Print rule-by-rule breakdown
    print(f"\n  ┌{'─' * 56}┐")
    print(f"  │ {'RULE-BY-RULE BREAKDOWN':^54} │")
    print(f"  ├{'─' * 56}┤")
    for check in report.checks:
        status_icon = {"PASS": "✅", "FAIL": "❌", "EXEMPTED": "🟢"}.get(check.status, "?")
        print(f"  │ {status_icon} {check.rule_name:<20} │ CDS: {check.distance_pct:>+7.1f}% │ Conf: {check.confidence:.0%} │")
    print(f"  └{'─' * 56}┘")
    
    # Print missing documents
    if report.missing_documents:
        print(f"\n  ⚠️  MISSING DOCUMENTS: {', '.join(report.missing_documents)}")
    else:
        print(f"\n  ✅ All required documents are present!")
    
    # ─── Sub-Agent 1.7: Plain Language Summary ───
    print("\n[Sub-Agent 1.7] 📝 Generating Plain English Summary...")
    plain_summary = generate_plain_summary(report)
    report.plain_summary = plain_summary
    print(plain_summary)
    
    # ─── Sub-Agent 1.7: Hindi Translation ───
    print("\n[Sub-Agent 1.7] 🇮🇳 Translating to Hindi...")
    hindi_summary = simplify_to_hindi(report)
    report.hindi_summary = hindi_summary
    print(hindi_summary)
    
    # ─── Sub-Agent 1.9: Scheme Discoverer ───
    print("\n[Sub-Agent 1.9] 🏦 Discovering Schemes for Failures...")
    schemes = discover_schemes(report)
    report.recommended_schemes = schemes
    if schemes:
        for scheme in schemes:
            print(f"  💡 {scheme}")
    else:
        print("  ✅ No schemes needed. MSME passed all financial/technical checks!")

    # ─── Sub-Agent 1.10: Payment Tracker (Standalone Demo) ───
    print("\n[Sub-Agent 1.10] 💸 Testing Payment Tracker (Standalone)...")
    penalty_report = calculate_payment_penalty(
        invoice_date_str="2023-01-01",
        payment_date_str="2023-05-01", # 4 months late
        principal_amount=500000.0,
        company_name="Bharat Precision Engineering",
        buyer_name="Ministry of Railways"
    )
    print(f"  🚨 Penalty Owed: ₹{penalty_report.penalty_amount_inr:,.2f}")
    print(f"  ⏳ Days Delayed: {penalty_report.days_overdue}")
    
    # ─── Final JSON Output (What the API would return to the frontend) ───
    print("\n" + "=" * 60)
    print("  COMPLETE API RESPONSE (JSON for Frontend)")
    print("=" * 60)
    print(report.model_dump_json(indent=2))
    print("\n✅ Pipeline complete! All 8 Sub-Agents executed successfully.")


if __name__ == "__main__":
    if not os.getenv("GEMINI_API_KEY"):
        print("ERROR: GEMINI_API_KEY not found in environment!")
        print("Please set it in your .env file: GEMINI_API_KEY=your_key_here")
    else:
        test_full_pipeline()

import pytest
from src.models.schemas import MSMEProfile, TenderRequirements
from src.agents.nlp_copilot.symbolic_verifier import verify_eligibility, _calculate_cds
from src.agents.nlp_copilot.payment_tracker import calculate_payment_penalty
from src.agents.nlp_copilot.scheme_discoverer import discover_schemes

# ═══════════════════════════════════════════════════════════
# 1. Test the CDS (Compliance Distance Score) Math Formula
# ═══════════════════════════════════════════════════════════
def test_cds_calculation():
    # If 3 years experience required, and you have 5 -> +66.7%
    assert _calculate_cds(actual=5, required=3) == 66.7
    
    # If 2 years required, and you have 1 -> -50.0%
    assert _calculate_cds(actual=1, required=2) == -50.0
    
    # If 0 required (no rule), automatic 100% pass
    assert _calculate_cds(actual=10, required=0) == 100.0

# ═══════════════════════════════════════════════════════════
# 2. Test a PERFECT MSME Profile (Should Pass Everything)
# ═══════════════════════════════════════════════════════════
def test_symbolic_verifier_pass():
    # Mock LLM Extracted Rules
    rules = TenderRequirements(
        emd_amount=0,
        turnover_required=1000000,
        experience_years=2,
        required_certifications=["ISO 9001"],
        is_msme_exempted=False
    )
    
    # Mock MSME User Profile
    profile = MSMEProfile(
        company_name="Perfect Tech Pvt Ltd",
        turnover_inr=2000000,
        experience_years=3,
        certifications=["ISO 9001"],
        is_msme_registered=False
    )
    
    report = verify_eligibility(rules, profile)
    
    assert report.is_eligible == True
    assert report.overall_compliance_score == 100.0
    assert len(report.missing_documents) == 0

# ═══════════════════════════════════════════════════════════
# 3. Test MSME Exemptions (Overriding the LLM rules legally)
# ═══════════════════════════════════════════════════════════
def test_symbolic_verifier_msme_exemption():
    rules = TenderRequirements(
        emd_amount=50000,
        turnover_required=1000000,
        experience_years=2,
        required_certifications=[],
        is_msme_exempted=True
    )
    
    profile = MSMEProfile(
        company_name="Small Indian Business",
        turnover_inr=500000, # FAILING TURNOVER! (only 5L, need 10L)
        experience_years=3,
        certifications=[],
        is_msme_registered=True # BUT REGISTERED AS MSME!
    )
    
    report = verify_eligibility(rules, profile)
    
    # Even though turnover is too low, the MSME law overrides it!
    assert report.is_eligible == True
    
    # Check that the EMD and Turnover rows were marked as "EXEMPTED"
    assert report.checks[0].status.value == "EXEMPTED" # EMD
    assert report.checks[1].status.value == "EXEMPTED" # Turnover

# ═══════════════════════════════════════════════════════════
# 4. Test Scheme Discoverer (If they fail, does it recommend?)
# ═══════════════════════════════════════════════════════════
def test_scheme_discoverer_recommendations():
    # Force a failing scenario
    rules = TenderRequirements(
        emd_amount=0, turnover_required=10000000, experience_years=5,
        required_certifications=[], is_msme_exempted=False
    )
    profile = MSMEProfile(
        company_name="Startup", turnover_inr=100000, experience_years=0,
        certifications=[], is_msme_registered=False
    )
    
    report = verify_eligibility(rules, profile)
    schemes = discover_schemes(report)
    
    assert len(schemes) > 0
    assert "CGTMSE" in schemes[0] or "ZED" in schemes[0] # Should recommend something

# ═══════════════════════════════════════════════════════════
# 5. Test Payment Penalty Tracker (Strict math validation)
# ═══════════════════════════════════════════════════════════
def test_payment_tracker_penalty():
    # 91 days delay
    report = calculate_payment_penalty(
        invoice_date_str="2024-01-01",
        payment_date_str="2024-04-01", 
        principal_amount=100000,
        company_name="Bharat MSME",
        buyer_name="Gov Dept"
    )
    
    assert report.days_overdue > 45
    assert report.is_penalty_applicable == True
    assert report.penalty_amount_inr > 0
    assert "Demand Notice" in report.demand_notice_draft

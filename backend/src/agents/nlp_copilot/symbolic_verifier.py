from src.models.schemas import (
    TenderRequirements, MSMEProfile, VerificationReport,
    RuleVerification, RuleStatus
)
from typing import List


# ═══════════════════════════════════════════════════════════
# CDS FORMULA — Original Research Contribution
# ═══════════════════════════════════════════════════════════
#
# Compliance Distance Score (CDS):
#   CDS(rule_i) = ((actual - required) / required) * 100
#
# Positive CDS = exceeds requirement (good)
# Negative CDS = falls short (bad)
# Zero CDS     = exactly meets requirement
#
# Overall Compliance Distance (OCD):
#   OCD = Σ(weight_i × normalized_score_i) / Σ(weight_i)
#
# Weights: EMD=3, Turnover=2, Experience=2, Certification=1
# ═══════════════════════════════════════════════════════════

# Domain-specific weights derived from analysis of GeM tender documents
RULE_WEIGHTS = {
    "EMD": 3,
    "Turnover": 2,
    "Experience": 2,
    "Certification": 1,
}


def _calculate_cds(actual: float, required: float) -> float:
    """
    Calculate the Compliance Distance Score for a single numeric rule.
    Returns a percentage: positive means exceeds, negative means falls short.
    """
    if required == 0:
        return 100.0  # No requirement = automatic pass
    return round(((actual - required) / required) * 100, 1)


def _check_documents(
    required_certs: List[str], msme_certs: List[str]
) -> List[str]:
    """
    Sub-Agent 1.8: Document Readiness Checker.
    Compares the tender's required certifications against the MSME's vault.
    Returns a list of MISSING documents.
    """
    missing = []
    for cert in required_certs:
        # Case-insensitive comparison for robustness
        if not any(c.lower() == cert.lower() for c in msme_certs):
            missing.append(cert)
    return missing


def _calculate_ocd(checks: List[RuleVerification]) -> float:
    """
    Calculate the Overall Compliance Distance score (0 to 100).
    Uses domain-specific weights for each rule category.
    100 = fully compliant, 0 = completely non-compliant.
    """
    total_weight = 0
    weighted_sum = 0.0

    for check in checks:
        # Determine the weight for this rule
        weight = 1  # default
        for key, w in RULE_WEIGHTS.items():
            if key.lower() in check.rule_name.lower():
                weight = w
                break

        # Normalize: PASS/EXEMPTED = 100, FAIL = max(0, 100 + distance_pct)
        if check.status in (RuleStatus.PASS, RuleStatus.EXEMPTED):
            normalized = 100.0
        else:
            # A distance of -40% means they score 60 out of 100
            normalized = max(0.0, 100.0 + check.distance_pct)

        weighted_sum += weight * normalized
        total_weight += weight

    if total_weight == 0:
        return 100.0
    return round(weighted_sum / total_weight, 1)


def verify_eligibility(
    rules: TenderRequirements, msme: MSMEProfile
) -> VerificationReport:
    """
    Sub-Agents 1.4 + 1.6 + 1.8: Symbolic Verifier with CDS and Document Checking.

    This strictly uses deterministic Python math/logic to verify eligibility.
    NO AI is used here to prevent hallucination.

    Returns a rich VerificationReport with:
    - Per-rule traffic lights (PASS/FAIL/EXEMPTED)
    - Compliance Distance Scores (CDS) for each rule
    - Missing document alerts
    - Overall Compliance Distance (OCD)
    """
    is_eligible = True
    checks: List[RuleVerification] = []
    reasoning: List[str] = []  # Legacy text reasoning

    # ─── Check MSME Exemption Status ───
    msme_exempt = rules.is_msme_exempted and msme.is_registered_msme

    # ─── 1. EMD CHECK ───
    if rules.emd_amount > 0:
        if msme_exempt:
            checks.append(RuleVerification(
                rule_name="EMD Amount",
                status=RuleStatus.EXEMPTED,
                required_value=f"₹{rules.emd_amount:,}",
                actual_value="₹0 (MSME Exempted)",
                distance_pct=100.0,
                confidence=rules.emd_confidence,
                source_page=rules.emd_source_page,
                message=f"EMD of ₹{rules.emd_amount:,} is WAIVED because {msme.company_name} holds valid Udyam/MSME registration."
            ))
            reasoning.append(f"✅ EMD: ₹{rules.emd_amount:,} → EXEMPTED (MSME registered)")
        else:
            # For EMD, we do a simple pass (assumes MSME can pay if they proceed)
            checks.append(RuleVerification(
                rule_name="EMD Amount",
                status=RuleStatus.PASS,
                required_value=f"₹{rules.emd_amount:,}",
                actual_value=f"₹{rules.emd_amount:,} (payable)",
                distance_pct=0.0,
                confidence=rules.emd_confidence,
                source_page=rules.emd_source_page,
                message=f"EMD of ₹{rules.emd_amount:,} is required and must be paid with the bid."
            ))
            reasoning.append(f"🟡 EMD: ₹{rules.emd_amount:,} required (payable)")
    else:
        checks.append(RuleVerification(
            rule_name="EMD Amount",
            status=RuleStatus.PASS,
            required_value="₹0",
            actual_value="₹0",
            distance_pct=100.0,
            confidence=rules.emd_confidence,
            source_page=rules.emd_source_page,
            message="No EMD is required for this tender."
        ))
        reasoning.append("✅ EMD: Not required")

    # ─── 2. TURNOVER CHECK (with CDS Formula) ───
    if rules.turnover_required > 0:
        turnover_cds = _calculate_cds(msme.turnover_inr, rules.turnover_required)

        if msme_exempt:
            checks.append(RuleVerification(
                rule_name="Turnover Requirement",
                status=RuleStatus.EXEMPTED,
                required_value=f"₹{rules.turnover_required:,}",
                actual_value=f"₹{msme.turnover_inr:,}",
                distance_pct=turnover_cds,
                confidence=rules.turnover_confidence,
                source_page=rules.turnover_source_page,
                message=f"Turnover requirement of ₹{rules.turnover_required:,} is WAIVED for registered MSMEs. Your actual turnover is ₹{msme.turnover_inr:,} ({turnover_cds:+.1f}%)."
            ))
            reasoning.append(f"✅ Turnover: ₹{rules.turnover_required:,} required, you have ₹{msme.turnover_inr:,} ({turnover_cds:+.1f}%) → EXEMPTED")
        elif msme.turnover_inr >= rules.turnover_required:
            checks.append(RuleVerification(
                rule_name="Turnover Requirement",
                status=RuleStatus.PASS,
                required_value=f"₹{rules.turnover_required:,}",
                actual_value=f"₹{msme.turnover_inr:,}",
                distance_pct=turnover_cds,
                confidence=rules.turnover_confidence,
                source_page=rules.turnover_source_page,
                message=f"Your turnover of ₹{msme.turnover_inr:,} exceeds the requirement of ₹{rules.turnover_required:,} by {turnover_cds:+.1f}%."
            ))
            reasoning.append(f"✅ Turnover: ₹{rules.turnover_required:,} required, you have ₹{msme.turnover_inr:,} ({turnover_cds:+.1f}%) → PASS")
        else:
            is_eligible = False
            checks.append(RuleVerification(
                rule_name="Turnover Requirement",
                status=RuleStatus.FAIL,
                required_value=f"₹{rules.turnover_required:,}",
                actual_value=f"₹{msme.turnover_inr:,}",
                distance_pct=turnover_cds,
                confidence=rules.turnover_confidence,
                source_page=rules.turnover_source_page,
                message=f"❌ Your turnover of ₹{msme.turnover_inr:,} is {abs(turnover_cds):.1f}% SHORT of the required ₹{rules.turnover_required:,}."
            ))
            reasoning.append(f"❌ Turnover: ₹{rules.turnover_required:,} required, you have ₹{msme.turnover_inr:,} ({turnover_cds:+.1f}%) → FAIL")

    # ─── 3. EXPERIENCE CHECK (with CDS Formula) ───
    if rules.experience_years > 0:
        exp_cds = _calculate_cds(msme.experience_years, rules.experience_years)

        if msme.experience_years >= rules.experience_years:
            checks.append(RuleVerification(
                rule_name="Experience Requirement",
                status=RuleStatus.PASS,
                required_value=f"{rules.experience_years} years",
                actual_value=f"{msme.experience_years} years",
                distance_pct=exp_cds,
                confidence=rules.experience_confidence,
                source_page=rules.experience_source_page,
                message=f"Your experience of {msme.experience_years} years exceeds the requirement of {rules.experience_years} years by {exp_cds:+.1f}%."
            ))
            reasoning.append(f"✅ Experience: {rules.experience_years} yrs required, you have {msme.experience_years} yrs ({exp_cds:+.1f}%) → PASS")
        else:
            is_eligible = False
            checks.append(RuleVerification(
                rule_name="Experience Requirement",
                status=RuleStatus.FAIL,
                required_value=f"{rules.experience_years} years",
                actual_value=f"{msme.experience_years} years",
                distance_pct=exp_cds,
                confidence=rules.experience_confidence,
                source_page=rules.experience_source_page,
                message=f"❌ Your experience of {msme.experience_years} years is {abs(exp_cds):.1f}% SHORT of the required {rules.experience_years} years."
            ))
            reasoning.append(f"❌ Experience: {rules.experience_years} yrs required, you have {msme.experience_years} yrs ({exp_cds:+.1f}%) → FAIL")

    # ─── 4. CERTIFICATION CHECK (Sub-Agent 1.8: Document Vault) ───
    missing_docs = _check_documents(rules.required_certifications, msme.certifications)

    if missing_docs:
        is_eligible = False
        for doc in missing_docs:
            checks.append(RuleVerification(
                rule_name=f"Certification: {doc}",
                status=RuleStatus.FAIL,
                required_value=doc,
                actual_value="MISSING",
                distance_pct=-100.0,
                confidence=0.9,
                source_page=0,
                message=f"❌ You are missing the required '{doc}' certification. Upload it to your Document Vault before the deadline."
            ))
        reasoning.append(f"❌ Missing Documents: {', '.join(missing_docs)}")
    else:
        if rules.required_certifications:
            reasoning.append(f"✅ All required certifications present: {', '.join(rules.required_certifications)}")
        else:
            reasoning.append("✅ No special certifications required.")

    # ─── 5. CALCULATE OVERALL COMPLIANCE DISTANCE (OCD) ───
    ocd = _calculate_ocd(checks)

    # ─── 6. BUILD OVERALL VERDICT ───
    if is_eligible:
        reasoning.insert(0, f"🎉 {msme.company_name} is ELIGIBLE to bid! Overall Compliance Score: {ocd}%")
    else:
        reasoning.insert(0, f"🚫 {msme.company_name} is NOT eligible. Overall Compliance Score: {ocd}%")

    return VerificationReport(
        is_eligible=is_eligible,
        overall_compliance_score=ocd,
        checks=checks,
        missing_documents=missing_docs,
        reasoning=reasoning,
    )

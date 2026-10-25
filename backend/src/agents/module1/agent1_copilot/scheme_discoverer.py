import os
from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from src.models.schemas import VerificationReport, RuleVerification

# Static database of MSME schemes for MVP
MSME_SCHEMES = [
    {
        "name": "ZED Certification Scheme",
        "description": "Financial assistance for MSMEs to obtain Zero Defect Zero Effect (ZED) certification. Good for manufacturing and quality gaps.",
        "link": "https://zed.msme.gov.in/"
    },
    {
        "name": "CGTMSE Credit Guarantee Scheme",
        "description": "Collateral-free credit (loans) up to ₹500 Lakhs for MSMEs. Perfect for bridging turnover or capital gaps.",
        "link": "https://www.cgtmse.in/"
    },
    {
        "name": "PM Vishwakarma Scheme",
        "description": "Support for traditional artisans and craftspeople. Includes skill training and ₹3 Lakhs collateral-free credit.",
        "link": "https://pmvishwakarma.gov.in/"
    },
    {
        "name": "Mudra Yojana (PMMY)",
        "description": "Loans up to ₹10 Lakhs for non-corporate, non-farm small/micro enterprises. Good for starting up or early experience gaps.",
        "link": "https://www.mudra.org.in/"
    },
    {
        "name": "ICD (International Cooperation Scheme)",
        "description": "Financial assistance to MSMEs to participate in international exhibitions. Good for expanding footprint.",
        "link": "https://msme.gov.in/international-cooperation-scheme"
    }
]

def discover_schemes(report: VerificationReport) -> List[str]:
    """
    Sub-Agent 1.9: Scheme Discoverer
    Analyzes the failure points in the Verification Report and recommends
    government schemes that can help bridge those gaps.
    """
    if report.is_eligible:
        return ["You are already eligible for this bid! No special bridging schemes required right now."]

    # 1. Identify what failed
    failures = []
    for check in report.checks:
        if check.status == "FAIL":
            failures.append(f"Rule: {check.rule_name} | Required: {check.required_value} | Actual: {check.actual_value} | Message: {check.message}")
    
    if not failures:
        return ["You are eligible, but double check your documents."]

    failures_text = "\n".join(failures)
    
    # 2. Format available schemes
    schemes_text = ""
    for s in MSME_SCHEMES:
        schemes_text += f"- {s['name']}: {s['description']} (Link: {s['link']})\n"

    # 3. Use LLM to match failures to schemes if API key is present
    if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
        return [f"{s['name']}: {s['description']} (Link: {s['link']})" for s in MSME_SCHEMES[:2]]

    try:
        llm = ChatGoogleGenerativeAI(model="gemini-3.6-flash")
    except Exception:
        return [f"{s['name']}: {s['description']} (Link: {s['link']})" for s in MSME_SCHEMES[:2]]

    prompt_template = """
    You are an expert MSME Government Advisor.
    An MSME has failed the eligibility criteria for a government tender. 
    Below are the reasons they failed:
    
    FAILED CRITERIA:
    {failures}
    
    Below is a list of available government schemes:
    AVAILABLE SCHEMES:
    {schemes}
    
    Your task is to recommend 1 to 3 schemes from the available list that will EXACTLY help them overcome their specific failures.
    For example, if they failed due to low turnover, recommend a loan scheme like CGTMSE. If they failed due to missing quality certifications, recommend ZED.
    
    Format your response as a simple bulleted list. 
    For each recommendation, explain in ONE sentence WHY it helps with their specific failure, and include the link.
    DO NOT recommend a scheme if it doesn't make sense for their failures.
    """

    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["failures", "schemes"]
    )

    chain = prompt | llm

    try:
        result = chain.invoke({
            "failures": failures_text,
            "schemes": schemes_text
        })
        
        content = result.content if hasattr(result, 'content') else str(result)
        
        # Split by newlines and clean up
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        return lines
    except Exception as e:
        print(f"Error in Scheme Discoverer: {e}")
        return ["Unable to retrieve scheme recommendations at this time."]

if __name__ == "__main__":
    pass

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from src.models.schemas import TenderRequirements
import json

def extract_rules_with_gemini(combined_chunks: str) -> TenderRequirements:
    """
    Sub-Agent 1.3 + 1.5: Neural Extractor with Confidence Scoring.
    
    Takes the retrieved text chunks and uses Gemini to extract structured JSON.
    Enhanced to also self-assess confidence (0.0-1.0) and cite source pages,
    which powers the Confidence Scorer (Sub-Agent 1.5).
    """
    # 1. Initialize the Gemini LLM
    # We use gemini-2.5-flash because it is extremely fast and handles large context windows perfectly
    llm = ChatGoogleGenerativeAI(model="gemini-3.6-flash")
    
    # 2. Force the LLM to output ONLY our Pydantic JSON schema
    structured_llm = llm.with_structured_output(TenderRequirements)
    
    # 3. Create the enhanced prompt template with confidence scoring instructions
    prompt_template = """
    You are an expert government tender analyst specializing in Indian public procurement.
    Read the following text extracted from a government tender document.
    Extract the specific requirements and output them exactly according to the schema.
    
    CRITICAL INSTRUCTIONS:
    1. For each rule you extract (EMD, Turnover, Experience), you MUST also provide:
       - A confidence score (0.0 to 1.0) indicating how certain you are that the value is correct.
         Use 0.9+ only if the value is explicitly and unambiguously stated.
         Use 0.5-0.8 if you had to infer or the language was ambiguous.
         Use below 0.5 if you are guessing.
       - The page number where you found the information (0 if unknown).
    
    2. If a value is not found, use 0 for numbers, or an empty list for arrays.
       Set confidence to 0.0 for values that were not found in the text.
    
    3. Look out for MSME / Udyam / Startup India exemptions very carefully.
       These are often buried in clauses about EMD waiver or prior turnover relaxation.
    
    4. For certifications, only list ones that are MANDATORY for bid submission,
       not "preferred" or "desirable" ones.
    
    Tender Text:
    {text}
    """
    
    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["text"]
    )
    
    # 4. Create and run the chain
    chain = prompt | structured_llm
    
    result = chain.invoke({"text": combined_chunks})
    
    return result

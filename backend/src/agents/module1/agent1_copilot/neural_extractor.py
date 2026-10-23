from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from src.models.schemas import TenderRequirements
import json
import os

def extract_rules_with_gemini(combined_chunks: str) -> TenderRequirements:
    """
    Sub-Agent 1.3 + 1.5: Neural Extractor with Confidence Scoring.
    
    Takes the retrieved text chunks and uses Hugging Face Serverless to extract structured JSON.
    Enhanced to also self-assess confidence (0.0-1.0) and cite source pages,
    which powers the Confidence Scorer (Sub-Agent 1.5).
    """
    # 1. Initialize the LLM via Hugging Face Serverless API
    llm = ChatHuggingFace(
        llm=HuggingFaceEndpoint(
            repo_id="meta-llama/Llama-3.1-8B-Instruct",
            task="text-generation",
            huggingfacehub_api_token=os.environ.get("HF_TOKEN"),
            temperature=0.1,
            max_new_tokens=1024,
        )
    )
    
    # 2. Use Pydantic Output Parser
    parser = PydanticOutputParser(pydantic_object=TenderRequirements)
    
    # 3. Create the enhanced prompt template with confidence scoring instructions
    prompt_template = """<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an expert government tender analyst specializing in Indian public procurement.
Read the following text extracted from a government tender document.
Extract the specific requirements and output them exactly according to the schema.

CRITICAL RULE: YOU MUST OUTPUT ONLY VALID JSON. Do not include any markdown formatting, do not wrap in ```json, and do not include any conversational text. Just output the raw JSON object starting with {{ and ending with }}.

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
   
{format_instructions}<|eot_id|><|start_header_id|>user<|end_header_id|>
Tender Text:
{text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>
"""
    
    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["text"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    
    # 4. Create and run the robust chain
    chain = prompt | llm | parser
    
    result = chain.invoke({"text": combined_chunks})
    
    return result

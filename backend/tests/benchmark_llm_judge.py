import os
import sys
import json
import time
import glob
import random
import warnings
import logging
from typing import List
from dotenv import load_dotenv

# Suppress annoying PyTorch deprecation warnings for a clean terminal output
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
logging.getLogger("torch").setLevel(logging.ERROR)

# Load environment variables (API Keys) from root .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"))

# Fix encoding for Windows terminal
sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.agents.nlp_copilot.pdf_extractor import extract_text_from_pdf
from src.agents.nlp_copilot.rag_retriever import chunk_text, build_hybrid_retriever, retrieve_relevant_chunks
from src.agents.nlp_copilot.neural_extractor import extract_rules_with_gemini
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

# ═══════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════
SAMPLE_SIZE = 5 # Number of PDFs to test randomly. Change to 20 for full dataset.
TEST_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "test_data")

# ═══════════════════════════════════════════════════════════
# JUDGE SCHEMA
# ═══════════════════════════════════════════════════════════
class JudgeEvaluation(BaseModel):
    accuracy_score: float = Field(
        description="Score from 1.0 to 10.0 based on how perfectly the JSON captures the true requirements from the text."
    )
    is_hallucinated: bool = Field(
        description="Set to True ONLY if the JSON contains numbers or strict rules that DO NOT physically exist anywhere in the raw text. False otherwise."
    )
    reasoning: str = Field(
        description="A short 1-sentence explanation of why you gave this score."
    )

def evaluate_with_judge(raw_text: str, extracted_json: str) -> JudgeEvaluation:
    """Uses OpenRouter to act as an impartial judge with Pydantic parser."""
    llm = ChatHuggingFace(
        llm=HuggingFaceEndpoint(
            repo_id="meta-llama/Llama-3.1-8B-Instruct",
            task="text-generation",
            huggingfacehub_api_token=os.environ.get("HF_TOKEN"),
            temperature=0.1,
            max_new_tokens=1024,
        )
    )
    
    parser = PydanticOutputParser(pydantic_object=JudgeEvaluation)
    
    prompt = PromptTemplate(
        template="""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an impartial, strict MLOps Judge. 
Your job is to evaluate an AI's data extraction performance.

CRITICAL RULE: YOU MUST OUTPUT ONLY VALID JSON. Do not include any markdown formatting, do not wrap in ```json, and do not include any conversational text like "Here is the evaluation". Just output the raw JSON object starting with {{ and ending with }}.

{format_instructions}<|eot_id|><|start_header_id|>user<|end_header_id|>
Here is the original text from a government tender PDF (it might be noisy):
=== RAW TEXT START ===
{raw_text}
=== RAW TEXT END ===

Here is the JSON that the AI pipeline extracted from that text:
=== EXTRACTED JSON ===
{extracted_json}
=== JSON END ===

Evaluate the extraction. Did it hallucinate? Is it completely accurate based on the raw text provided?<|eot_id|><|start_header_id|>assistant<|end_header_id|>
""",
        input_variables=["raw_text", "extracted_json"],
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )
    
    chain = prompt | llm | parser
    return chain.invoke({"raw_text": raw_text[:25000], "extracted_json": extracted_json})

# ═══════════════════════════════════════════════════════════
# MAIN BENCHMARK LOOP
# ═══════════════════════════════════════════════════════════
def run_benchmark():
    print("\n" + "="*60)
    print("🚀 STARTING LLM-AS-A-JUDGE BENCHMARK SUITE")
    print("="*60)
    
    all_pdfs = [f for f in os.listdir(TEST_DATA_DIR) if f.endswith(".pdf")]
    
    if not all_pdfs:
        print("❌ No PDFs found in test_data folder.")
        return
        
    # Randomly select PDFs
    selected_pdfs = random.sample(all_pdfs, min(SAMPLE_SIZE, len(all_pdfs)))
    print(f"📂 Evaluating a random sample of {len(selected_pdfs)} PDFs out of {len(all_pdfs)} total.")
    print("-" * 60)
    
    total_time = 0
    total_score = 0
    hallucination_count = 0
    
    for idx, pdf_name in enumerate(selected_pdfs):
        print(f"\n[{idx+1}/{len(selected_pdfs)}] Processing: {pdf_name} ...")
        start_time = time.time()
        
        pdf_path = os.path.join(TEST_DATA_DIR, pdf_name)
        
        try:
            # 1. Extract Text
            raw_text = extract_text_from_pdf(pdf_path)
            
            # 2. RAG Pipeline
            chunks = chunk_text(raw_text)
            retriever = build_hybrid_retriever(chunks)
            query = "What is the EMD amount, turnover requirement, experience requirement, MSME exemptions, and required certifications?"
            context = retrieve_relevant_chunks(retriever, query)
            
            # 3. Neural Extractor
            extracted_data = extract_rules_with_gemini(context)
            json_str = extracted_data.model_dump_json(indent=2)
            
            # 4. LLM Judge Evaluation
            print("   ⚖️ Calling LLM Judge to evaluate extraction...")
            judge_eval = evaluate_with_judge(raw_text, json_str)
            
            end_time = time.time()
            latency = end_time - start_time
            total_time += latency
            
            # Log results
            total_score += judge_eval.accuracy_score
            if judge_eval.is_hallucinated:
                hallucination_count += 1
                
            status_symbol = "❌ HALLUCINATION DETECTED" if judge_eval.is_hallucinated else "✅ CLEAN"
            
            print(f"   ⏱️ Latency: {latency:.2f} seconds")
            print(f"   🎯 Judge Score: {judge_eval.accuracy_score}/10.0 ({status_symbol})")
            print(f"   💬 Reasoning: {judge_eval.reasoning}")
            
        except Exception as e:
            print(f"   ❌ Error processing {pdf_name}: {e}")
            
        print("   ⏳ Sleeping for 5 seconds to respect Hugging Face free tier rate limits...")
        time.sleep(5)
            
    # ═══════════════════════════════════════════════════════════
    # FINAL REPORT
    # ═══════════════════════════════════════════════════════════
    num_processed = len(selected_pdfs)
    avg_latency = total_time / num_processed if num_processed > 0 else 0
    avg_score = total_score / num_processed if num_processed > 0 else 0
    hallucination_rate = (hallucination_count / num_processed) * 100 if num_processed > 0 else 0
    
    print("\n" + "="*60)
    print("🏆 FINAL BENCHMARK REPORT")
    print("="*60)
    print(f"Total PDFs Evaluated : {num_processed}")
    print(f"Average Latency      : {avg_latency:.2f} seconds per document")
    print(f"Average Judge Score  : {avg_score:.2f} / 10.0")
    print(f"Hallucination Rate   : {hallucination_rate:.1f}%")
    
    if hallucination_rate == 0:
        print("\n🌟 ENTERPRISE GRADE ACHIEVED: Zero hallucinations detected in this sample.")
    else:
        print("\n⚠️ WARNING: Hallucinations detected. Prompt tuning required.")
    print("="*60 + "\n")

if __name__ == "__main__":
    run_benchmark()

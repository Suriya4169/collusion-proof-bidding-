import os
from src.agents.nlp_copilot.pdf_extractor import extract_text_from_pdf
from src.agents.nlp_copilot.rag_retriever import chunk_text, build_hybrid_retriever, retrieve_relevant_chunks
from src.agents.nlp_copilot.neural_extractor import extract_rules_with_gemini
import sys
from dotenv import load_dotenv

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

files = [
    "test_data/GeM-Bidding-9394343.pdf",
    "test_data/GeM-Bidding-9558730.pdf"
]

for file_path in files:
    print(f"\n{'='*60}")
    print(f"📊 EXTRACTING FROM: {os.path.basename(file_path)}")
    print(f"{'='*60}")
    
    # 1. Extract
    with open(file_path, 'rb') as f:
        pdf_bytes = f.read()
    text = extract_text_from_pdf(pdf_bytes)
    
    # 2. RAG
    chunks = chunk_text(text)
    retriever = build_hybrid_retriever(chunks)
    query = "What is the EMD amount, turnover requirement, experience requirement, MSME exemptions, and required certifications?"
    relevant_text = retrieve_relevant_chunks(retriever, query)
    
    # 3. LLM Extraction
    rules = extract_rules_with_gemini(relevant_text)
    
    print(rules.model_dump_json(indent=2))
    print("\n")

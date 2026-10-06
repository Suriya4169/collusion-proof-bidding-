import os
import sys
from dotenv import load_dotenv

# Force UTF-8 encoding for Windows console printing
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Load the Gemini API Key
load_dotenv()

from src.agents.nlp_copilot.pdf_extractor import extract_text_from_pdf
from src.agents.nlp_copilot.rag_retriever import chunk_text, build_hybrid_retriever, retrieve_relevant_chunks

def test_rag_pipeline():
    pdf_path = r"d:\Final_year_Project\backend\test_data\GeM-Bidding-9292805.pdf"
    
    print(f"1. Extracting text from {pdf_path}...")
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
    raw_text = extract_text_from_pdf(pdf_bytes)
    print(f"   -> Extracted {len(raw_text)} characters.")
    
    print("2. Chunking text...")
    chunks = chunk_text(raw_text)
    print(f"   -> Created {len(chunks)} chunks.")
    
    print("3. Building Hybrid Retriever (Chroma Semantic + BM25 Keyword)...")
    # This will use the Gemini API key to embed the chunks
    retriever = build_hybrid_retriever(chunks)
    print("   -> Retriever built successfully!")
    
    print("4. Testing Multi-Query Retrieval...")
    queries = [
        "What is the Earnest Money Deposit (EMD) amount?",
        "What is the minimum average annual turnover requirement?"
    ]
    
    for query in queries:
        print(f"\nSearching for: '{query}'")
        print("-" * 50)
        result = retrieve_relevant_chunks(retriever, query)
        # Print just the first 500 characters of the combined results
        print(result[:500] + "...\n[CONTINUES]")
        print("-" * 50)

if __name__ == "__main__":
    if not os.getenv("GEMINI_API_KEY"):
        print("ERROR: GEMINI_API_KEY not found in .env file!")
    else:
        test_rag_pipeline()

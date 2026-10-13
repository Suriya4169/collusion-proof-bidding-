import os
import nltk
from typing import List, Dict

from src.agents.module1.agent1_copilot.pdf_extractor import extract_text_from_pdf

# Ensure the NLTK tokenizer model is available
try:
    nltk.sent_tokenize("Initialization test.")
except Exception:
    try:
        nltk.download('punkt', quiet=True)
        nltk.download('punkt_tab', quiet=True)
    except Exception:
        pass

def extract_clauses_from_pdf(pdf_path: str) -> List[str]:
    """
    Reads a PDF, extracts raw text, and splits it into individual sentences (clauses).
    """
    # 1. Extract raw text using Module 1's extractor
    raw_text = extract_text_from_pdf(pdf_path)
    
    # 2. Clean the text (remove excessive newlines, whitespace)
    # Often PDFs have newlines in the middle of sentences.
    cleaned_text = " ".join(raw_text.split())
    
    # 3. Use NLTK to intelligently split paragraphs into sentences
    sentences = nltk.tokenize.sent_tokenize(cleaned_text)
    
    # 4. Filter out garbage sentences (e.g., just numbers or very short strings)
    valid_clauses = [s.strip() for s in sentences if len(s.strip()) > 10]
    
    return valid_clauses

def extract_for_comparison(original_pdf_path: str, amended_pdf_path: str) -> Dict[str, List[str]]:
    """
    Sub-Agent 5.1: Clause Extractor
    Takes both the original and amended PDFs and returns lists of clauses for both.
    """
    print(f"[Sub-Agent 5.1] Extracting clauses from original: {original_pdf_path}")
    original_clauses = extract_clauses_from_pdf(original_pdf_path)
    
    print(f"[Sub-Agent 5.1] Extracting clauses from corrigendum: {amended_pdf_path}")
    amended_clauses = extract_clauses_from_pdf(amended_pdf_path)
    
    print(f"[Sub-Agent 5.1] Found {len(original_clauses)} original clauses and {len(amended_clauses)} amended clauses.")
    
    return {
        "original_clauses": original_clauses,
        "amended_clauses": amended_clauses
    }

# Quick testing block
if __name__ == "__main__":
    orig = "../../../test_data/GeM-Bidding-9292805.pdf"
    corr = "../../../test_data/GeM-Bidding-9292805-CORRIGENDUM.pdf"
    
    if os.path.exists(orig) and os.path.exists(corr):
        result = extract_for_comparison(orig, corr)
        print(f"Sample original clause: {result['original_clauses'][5]}")
        print(f"Sample amended clause: {result['amended_clauses'][5]}")

import os
import sys
from fpdf import FPDF

# Import our existing PDF extractor
from src.agents.module1_copilot.pdf_extractor import extract_text_from_pdf

def create_tampered_corrigendum():
    original_pdf_path = "test_data/GeM-Bidding-9292805.pdf"
    corrigendum_pdf_path = "test_data/GeM-Bidding-9292805-CORRIGENDUM.pdf"

    print(f"Reading original PDF: {original_pdf_path}")
    text = extract_text_from_pdf(original_pdf_path)

    # We will tamper with 3 specific things that are common in tenders to favor a specific vendor.
    
    # 1. Change EMD Amount (make it 10x higher to price out small players)
    tampered_text = text.replace("50000", "500000")
    
    # 2. Change Experience Requirement (from 3 Years to 8 Years)
    tampered_text = tampered_text.replace("3 Years", "8 Years")
    tampered_text = tampered_text.replace("3 Year", "8 Year")
    
    # 3. Change Turnover Requirement
    tampered_text = tampered_text.replace("48 Lakhs", "200 Lakhs")
    
    print("Modifications applied.")
    
    # Write to a new PDF using fpdf2
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Ensure we use a unicode font or fallback to latin-1 replacement
    pdf.set_font("Helvetica", size=10)
    
    # FPDF's built-in fonts only support latin-1. We'll encode it and ignore errors for this test document.
    encoded_text = tampered_text.encode('latin-1', 'replace').decode('latin-1')
    
    pdf.multi_cell(0, 5, encoded_text)
    
    pdf.output(corrigendum_pdf_path)
    print(f"Success! Tampered Corrigendum saved to: {corrigendum_pdf_path}")

if __name__ == "__main__":
    create_tampered_corrigendum()

import os
import sys
from src.agents.nlp_copilot.pdf_extractor import extract_text_from_pdf

# Force UTF-8 encoding for Windows console printing
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

def test_extraction():
    # Path to one of the downloaded test PDFs
    # Make sure this file exists in your Test_data folder
    pdf_path = r"d:\Final_year_Project\backend\test_data\GeM-Bidding-9292805.pdf"
    
    print(f"Testing extraction on: {pdf_path}")
    print("-" * 50)
    
    try:
        # Read the file as binary
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
            
        # Run our sub-agent function
        extracted_text = extract_text_from_pdf(pdf_bytes)
        
        # Print a preview of the extracted text
        print(f"Extraction Successful! Total length: {len(extracted_text)} characters.")
        print("Here is a preview of the first 500 characters:\n")
        print(extracted_text[:500])
        print("\n" + "-" * 50)
        
    except FileNotFoundError:
        print("Error: Could not find the PDF file. Please check the path.")

if __name__ == "__main__":
    test_extraction()

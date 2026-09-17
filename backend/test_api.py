import requests
import json
import os

# Base URL for the FastAPI Server
BASE_URL = "http://localhost:8000"

def test_payment_tracker():
    print("\n--- 💸 TESTING AGENT 1.10 (PAYMENT TRACKER) ---")
    url = f"{BASE_URL}/api/payments/track"
    
    # Payload for tracking a delayed payment
    payload = {
        "invoice_date": "2023-01-01",
        "payment_date": "2023-05-01",  # 4 months delayed!
        "invoice_amount_inr": 500000.0,
        "company_name": "Bharat Precision Engineering Pvt Ltd",
        "buyer_name": "Ministry of Railways"
    }
    
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        print("✅ SUCCESS! Here is the AI response:")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"❌ FAILED with status code: {response.status_code}")
        print(response.text)

def test_tender_analyzer():
    print("\n--- 🧠 TESTING AGENT 1 (NLP COPILOT) ---")
    url = f"{BASE_URL}/api/tender/analyze"
    
    # We need a dummy PDF to test the upload
    dummy_pdf_path = "test_dummy.pdf"
    with open(dummy_pdf_path, "w") as f:
        f.write("This is a dummy tender document requiring 3 years experience and 500000 EMD.")
        
    try:
        # Form Data for the MSME Profile
        data = {
            "company_name": "Bharat Precision Engineering",
            "turnover_inr": "15000000", # 1.5 Cr
            "experience_years": "5",
            "is_registered_msme": "true",
            "certifications": "ISO 9001, ZED Bronze"
        }
        
        # File Data for the PDF
        files = {
            "file": ("test_dummy.pdf", open(dummy_pdf_path, "rb"), "application/pdf")
        }
        
        print("Sending PDF and MSME Profile to the AI Pipeline... (Please wait ~5 seconds)")
        response = requests.post(url, data=data, files=files)
        
        if response.status_code == 200:
            print("✅ SUCCESS! Here is the massive AI analysis:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"❌ FAILED with status code: {response.status_code}")
            print(response.text)
            
    finally:
        # Clean up the dummy file
        if os.path.exists(dummy_pdf_path):
            os.remove(dummy_pdf_path)

if __name__ == "__main__":
    print("Starting Terminal Tests for Agent 1...")
    test_payment_tracker()
    test_tender_analyzer()

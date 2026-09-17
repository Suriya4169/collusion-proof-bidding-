import fitz  # PyMuPDF
import io

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract all raw text from a PDF file using PyMuPDF.
    
    Args:
        pdf_bytes (bytes): The raw bytes of the uploaded PDF file.
        
    Returns:
        str: The complete extracted text from all pages.
    """
    try:
        # Open the PDF from bytes
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        
        # Iterate through every page and extract text
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text += page.get_text("text") + "\n\n"
            
        doc.close()
        return text.strip()
    
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return ""

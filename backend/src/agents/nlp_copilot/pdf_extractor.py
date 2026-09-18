import fitz  # PyMuPDF
import io

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract all raw text from a PDF file using PyMuPDF.
    
    Args:
        file_path (str): The path to the PDF file on disk.
        
    Returns:
        str: The complete extracted text from all pages.
    """
    try:
        # Open the PDF from the file path
        doc = fitz.open(file_path)
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

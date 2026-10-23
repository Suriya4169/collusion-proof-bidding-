"""
PDF Extraction Service — Text-Layer Router + Password Support

Design Decision:
  - Uses pdfplumber for digital PDFs (preserved text layer → exact figures)
  - Falls back to PyMuPDF (fitz) text extraction for hybrid/scanned PDFs
  - Supports password-protected (encrypted) PDFs via optional password parameter
  - The LLM is NEVER used to transcribe numbers (only for layout mapping)
  - Follows Improvement 2 from the research: "LLM for layout, deterministic code for numbers"
"""

import io
import logging
import time
from pathlib import Path
from typing import Optional, Tuple

import pymupdf as fitz  # PyMuPDF (new import name)
import pdfplumber

logger = logging.getLogger("solvency_agent.pdf_extractor")


class PDFExtractionError(Exception):
    """Raised when PDF extraction fails irrecoverably."""
    pass


class PDFPasswordError(PDFExtractionError):
    """Raised when a password-protected PDF is submitted without the correct password."""
    pass


class PDFExtractor:
    """
    Extracts raw text from PDF bank statements.
    Routes between text-layer extraction and OCR-style fallback
    based on whether the PDF has embedded text.

    Supports password-protected PDFs — pass the password to :meth:`extract`.
    """

    def extract(
        self,
        pdf_bytes: bytes,
        filename: str = "uploaded.pdf",
        password: Optional[str] = None,
    ) -> Tuple[str, dict]:
        """
        Extract text from PDF bytes.

        Args:
            pdf_bytes: Raw PDF file bytes.
            filename:  Original filename (for metadata).
            password:  Optional decryption password for protected PDFs.

        Returns:
            (full_text, metadata_dict)

        Raises:
            PDFPasswordError: If the PDF is encrypted and the password is
                              missing or incorrect.
        """
        start_ms = time.time()
        metadata = {
            "pdf_filename": filename,
            "total_pages": 0,
            "has_text_layer": False,
            "extraction_method": "unknown",
            "extraction_time_ms": 0,
            "password_protected": False,
        }

        # ── Pre-flight: detect encryption via PyMuPDF ──────────────
        is_encrypted, pdf_bytes_decrypted = self._handle_encryption(
            pdf_bytes, password, metadata
        )

        # Use decrypted bytes for all subsequent extraction
        working_bytes = pdf_bytes_decrypted if is_encrypted else pdf_bytes

        # === Strategy 1: pdfplumber (best for digital-born PDFs with text layer) ===
        text_plumber = self._extract_with_pdfplumber(working_bytes, password)
        if text_plumber and len(text_plumber.strip()) > 50:
            metadata["has_text_layer"] = True
            metadata["extraction_method"] = "pdfplumber_text_layer"
            metadata["total_pages"] = self._count_pages_plumber(working_bytes, password)
            metadata["extraction_time_ms"] = int((time.time() - start_ms) * 1000)
            logger.info(f"[PDFExtractor] Text layer found ({len(text_plumber)} chars via pdfplumber)")
            return text_plumber, metadata

        # === Strategy 2: PyMuPDF (fitz) text extraction ===
        text_fitz = self._extract_with_pymupdf(working_bytes, password)
        if text_fitz and len(text_fitz.strip()) > 50:
            metadata["has_text_layer"] = True
            metadata["extraction_method"] = "pymupdf_text"
            metadata["total_pages"] = self._count_pages_fitz(working_bytes, password)
            metadata["extraction_time_ms"] = int((time.time() - start_ms) * 1000)
            logger.info(f"[PDFExtractor] Text extracted via PyMuPDF ({len(text_fitz)} chars)")
            return text_fitz, metadata

        # === Strategy 3: PyMuPDF table extraction (for structured table PDFs) ===
        text_tables = self._extract_tables_pymupdf(working_bytes, password)
        if text_tables and len(text_tables.strip()) > 50:
            metadata["has_text_layer"] = True
            metadata["extraction_method"] = "pymupdf_table_extraction"
            metadata["total_pages"] = self._count_pages_fitz(working_bytes, password)
            metadata["extraction_time_ms"] = int((time.time() - start_ms) * 1000)
            logger.info(f"[PDFExtractor] Tables extracted via PyMuPDF ({len(text_tables)} chars)")
            return text_tables, metadata

        # If none worked, return whatever pdfplumber got (even if sparse)
        metadata["extraction_method"] = "pdfplumber_sparse"
        metadata["total_pages"] = self._count_pages_plumber(working_bytes, password)
        metadata["extraction_time_ms"] = int((time.time() - start_ms) * 1000)
        logger.warning(f"[PDFExtractor] Sparse extraction — PDF may be scanned/image-based")
        return text_plumber or "", metadata

    # ─────────────────────────────────────────────────────────────
    # Encryption / Password Handling
    # ─────────────────────────────────────────────────────────────

    def _handle_encryption(
        self,
        pdf_bytes: bytes,
        password: Optional[str],
        metadata: dict,
    ) -> Tuple[bool, bytes]:
        """
        Detect whether the PDF is encrypted.  If it is, authenticate with the
        supplied password and return decrypted bytes.

        Returns:
            (is_encrypted, decrypted_bytes_or_original)

        Raises:
            PDFPasswordError on missing/wrong password.
        """
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            raise PDFExtractionError(f"Cannot open PDF: {e}")

        if not doc.is_encrypted:
            doc.close()
            return False, pdf_bytes

        # PDF is encrypted
        metadata["password_protected"] = True
        logger.info("[PDFExtractor] PDF is password-protected")

        if not password:
            doc.close()
            raise PDFPasswordError(
                "This PDF is password-protected. Please provide the password "
                "via the 'password' field."
            )

        # Attempt authentication
        auth_result = doc.authenticate(password)
        if auth_result == 0:
            doc.close()
            raise PDFPasswordError(
                "Incorrect password for this PDF. Please check and retry."
            )

        logger.info(f"[PDFExtractor] PDF authenticated successfully (auth_level={auth_result})")

        # Save decrypted bytes so downstream extractors don't need the password
        decrypted_bytes = doc.tobytes(deflate=True)
        doc.close()
        return True, decrypted_bytes

    # ─────────────────────────────────────────────────────────────
    # Strategy Implementations (password-aware)
    # ─────────────────────────────────────────────────────────────

    def _extract_with_pdfplumber(self, pdf_bytes: bytes, password: Optional[str] = None) -> str:
        """Extract text using pdfplumber — ideal for PDFs with embedded text layers."""
        try:
            pages_text = []
            open_kwargs = {}
            if password:
                open_kwargs["password"] = password
            with pdfplumber.open(io.BytesIO(pdf_bytes), **open_kwargs) as pdf:
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text() or ""
                    # Also attempt table extraction for structured data
                    tables = page.extract_tables()
                    table_text = ""
                    if tables:
                        for table in tables:
                            for row in table:
                                if row:
                                    table_text += " | ".join(str(cell or "") for cell in row) + "\n"

                    combined = text
                    if table_text and len(table_text) > len(text):
                        combined = table_text

                    pages_text.append(f"--- PAGE {i+1} ---\n{combined}")
            return "\n\n".join(pages_text)
        except Exception as e:
            logger.error(f"[pdfplumber] Extraction failed: {e}")
            return ""

    def _extract_with_pymupdf(self, pdf_bytes: bytes, password: Optional[str] = None) -> str:
        """Extract text using PyMuPDF — handles more PDF variants."""
        try:
            pages_text = []
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if doc.is_encrypted and password:
                doc.authenticate(password)
            for i, page in enumerate(doc):
                text = page.get_text("text")
                pages_text.append(f"--- PAGE {i+1} ---\n{text}")
            doc.close()
            return "\n\n".join(pages_text)
        except Exception as e:
            logger.error(f"[PyMuPDF] Extraction failed: {e}")
            return ""

    def _extract_tables_pymupdf(self, pdf_bytes: bytes, password: Optional[str] = None) -> str:
        """Extract tables specifically using PyMuPDF's table finder."""
        try:
            pages_text = []
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if doc.is_encrypted and password:
                doc.authenticate(password)
            for i, page in enumerate(doc):
                tabs = page.find_tables()
                if tabs and tabs.tables:
                    page_content = f"--- PAGE {i+1} ---\n"
                    for table in tabs.tables:
                        df = table.to_pandas()
                        page_content += df.to_string(index=False) + "\n"
                    pages_text.append(page_content)
                else:
                    text = page.get_text("text")
                    pages_text.append(f"--- PAGE {i+1} ---\n{text}")
            doc.close()
            return "\n\n".join(pages_text)
        except Exception as e:
            logger.error(f"[PyMuPDF tables] Extraction failed: {e}")
            return ""

    # ─────────────────────────────────────────────────────────────
    # Page Counting Helpers
    # ─────────────────────────────────────────────────────────────

    def _count_pages_plumber(self, pdf_bytes: bytes, password: Optional[str] = None) -> int:
        try:
            open_kwargs = {}
            if password:
                open_kwargs["password"] = password
            with pdfplumber.open(io.BytesIO(pdf_bytes), **open_kwargs) as pdf:
                return len(pdf.pages)
        except Exception:
            return 0

    def _count_pages_fitz(self, pdf_bytes: bytes, password: Optional[str] = None) -> int:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if doc.is_encrypted and password:
                doc.authenticate(password)
            count = len(doc)
            doc.close()
            return count
        except Exception:
            return 0

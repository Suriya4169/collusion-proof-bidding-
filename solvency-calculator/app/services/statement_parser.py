"""
Statement Parser Service — Page-by-Page Chunked LLM Parsing

Design Decision:
  - The LLM is used ONLY to identify column semantics and structure
    (which column is Date, Credit, Debit, Balance, Narration)
  - Numbers come from the deterministic text extraction, never from LLM generation
  - Uses schema-forced JSON output via Gemini's structured output mode
  - **Page-by-page chunking**: each page is sent to the LLM individually,
    then results are merged — this removes the 15k char truncation limit
    and supports statements of any length (100+ pages)
  - Falls back to regex-based parsing if no API key is available
"""

import json
import logging
import re
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("solvency_agent.statement_parser")

# ─────────────────────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────────────────────

# System-level context sent once to set the role
SYSTEM_CONTEXT = (
    "You are a bank statement parser.  You receive the raw text extracted "
    "from ONE page of a PDF bank statement.  Your job is to extract the "
    "structured financial data for that page ONLY.\n\n"
    "CRITICAL RULES:\n"
    "1. Extract EXACT numbers from the text. Do NOT round, estimate, or hallucinate any digits.\n"
    "2. If you cannot read a number clearly, use 0.0 and mark the narration as \"[UNCLEAR]\".\n"
    "3. Dates must be in YYYY-MM-DD format.\n"
    "4. Every transaction row must have: tx_id, date, narration, credit, debit, balance.\n"
    "5. For Indian number formats (1,23,456.78 or 1,23,456), parse them correctly as standard floats.\n"
    "6. Credits (Cr) are inflows. Debits (Dr) are outflows.\n"
    "7. If a column shows 'Withdrawal' or 'Debit', those are debits. 'Deposit' or 'Credit' are credits.\n"
    "8. Generate sequential tx_id values like TX_001, TX_002, etc.\n"
    "9. The opening_balance is the balance BEFORE the first transaction on this page.\n"
    "10. The closing_balance is the balance AFTER the last transaction on this page.\n"
)

# Per-page prompt (the page text is appended after this)
PAGE_PROMPT = """Given the following raw text from PAGE {page_number} of a bank statement,
extract ONLY the data that appears on this page.

Return a JSON object with this EXACT structure:
{{
  "page_number": {page_number},
  "opening_balance": 100000.00,
  "closing_balance": 150000.00,
  "transactions": [
    {{
      "tx_id": "TX_001",
      "date": "2025-10-05",
      "narration": "Transaction description",
      "credit": 50000.00,
      "debit": 0.0,
      "balance": 150000.00
    }}
  ]
}}

If this page has no transactions (e.g. only header/footer), return:
{{"page_number": {page_number}, "opening_balance": 0, "closing_balance": 0, "transactions": []}}

Raw text for page {page_number}:
"""

# Header extraction prompt (run once on the first page or two)
HEADER_PROMPT = """Extract the account holder information from this bank statement header.

Return a JSON object with this EXACT structure:
{
  "name": "Account Holder Name",
  "account_number": "1234567890",
  "bank": "Bank Name",
  "period": "DD-MMM-YYYY to DD-MMM-YYYY"
}

If a field cannot be determined, use an empty string.

Raw text:
"""


class StatementParser:
    """
    Parses raw extracted text into structured JSON statement data.
    Uses Gemini LLM for layout/column mapping, with regex fallback.

    **Page-by-page chunking** — each ``--- PAGE N ---`` section is sent
    to the LLM individually, eliminating token-limit truncation for long
    statements (20+ pages).
    """

    def __init__(self, gemini_api_key: Optional[str] = None):
        self.gemini_api_key = gemini_api_key
        self._gemini_model = None

    def _init_gemini(self, api_key: str):
        """Lazy-initialize Gemini client."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self._gemini_model = genai.GenerativeModel("gemini-2.0-flash")
            logger.info("[StatementParser] Gemini model initialized (gemini-2.0-flash)")
        except Exception as e:
            logger.error(f"[StatementParser] Failed to init Gemini: {e}")
            self._gemini_model = None

    def parse(self, raw_text: str, api_key: Optional[str] = None) -> tuple[Dict[str, Any], int]:
        """
        Parse raw PDF text into structured statement JSON.

        Returns:
            (statement_dict, llm_time_ms)
        """
        effective_key = api_key or self.gemini_api_key

        if effective_key:
            result, llm_time = self._parse_with_llm_chunked(raw_text, effective_key)
            if result and result.get("pages"):
                return result, llm_time
            logger.warning("[StatementParser] LLM parsing returned empty; falling back to regex")

        # Fallback: regex-based parsing
        result = self._parse_with_regex(raw_text)
        return result, 0

    # ─────────────────────────────────────────────────────────────
    # Page-by-Page Chunked LLM Parsing
    # ─────────────────────────────────────────────────────────────

    def _parse_with_llm_chunked(
        self, raw_text: str, api_key: str
    ) -> tuple[Optional[Dict[str, Any]], int]:
        """
        Parse the raw text page-by-page via the LLM.

        1. Split raw text by ``--- PAGE N ---`` markers.
        2. Send each page chunk individually to Gemini.
        3. Merge all page results into a single statement dict.
        4. Extract account info from the first page(s) header.

        This removes the previous 15k-char truncation and supports
        statements of arbitrary length.
        """
        total_start = time.time()

        if not self._gemini_model:
            self._init_gemini(api_key)
        if not self._gemini_model:
            return None, 0

        # Split raw text into per-page chunks
        page_chunks = self._split_into_pages(raw_text)
        if not page_chunks:
            logger.warning("[StatementParser] No page sections found in extracted text")
            # Fall back to treating the entire text as a single page
            page_chunks = [(1, raw_text)]

        logger.info(f"[StatementParser] Processing {len(page_chunks)} page(s) via LLM (chunked)")

        # Step 1: Extract account info from first ~2 pages
        header_text = "\n".join(
            text for _, text in page_chunks[:2]
        )[:5000]  # Header info is always in the first few KB
        account_info = self._extract_account_info_llm(header_text)

        # Step 2: Process each page individually
        all_pages: List[Dict[str, Any]] = []
        global_tx_counter = 1

        for page_num, page_text in page_chunks:
            page_result = self._parse_single_page(page_num, page_text, global_tx_counter)
            if page_result and page_result.get("transactions"):
                # Re-number tx_ids to be globally sequential
                for tx in page_result["transactions"]:
                    tx["tx_id"] = f"TX_{global_tx_counter:03d}"
                    global_tx_counter += 1
                all_pages.append(page_result)

        elapsed_ms = int((time.time() - total_start) * 1000)
        logger.info(
            f"[StatementParser] Chunked LLM parsing complete: "
            f"{len(all_pages)} pages with transactions ({elapsed_ms}ms total)"
        )

        if not all_pages:
            return None, elapsed_ms

        return {
            "account_info": account_info,
            "pages": all_pages,
        }, elapsed_ms

    def _split_into_pages(self, raw_text: str) -> List[tuple[int, str]]:
        """
        Split raw text by ``--- PAGE N ---`` markers into (page_number, text) tuples.
        """
        # Pattern matches the page markers inserted by PDFExtractor
        sections = re.split(r"---\s*PAGE\s+(\d+)\s*---", raw_text)

        pages = []
        if len(sections) <= 1:
            # No page markers — return entire text as page 1
            return [(1, raw_text)]

        i = 1
        while i < len(sections):
            page_num = int(sections[i])
            page_text = sections[i + 1] if i + 1 < len(sections) else ""
            if page_text.strip():
                pages.append((page_num, page_text))
            i += 2

        return pages

    def _parse_single_page(
        self, page_number: int, page_text: str, tx_start_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Send a single page's text to the LLM and return the structured result.
        Caps per-page text at 8000 chars (a single page rarely exceeds this).
        """
        try:
            prompt = PAGE_PROMPT.format(page_number=page_number) + page_text[:8000]

            response = self._gemini_model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.0,
                    "response_mime_type": "application/json",
                }
            )

            result_text = response.text.strip()
            # Strip markdown code fences if present
            if result_text.startswith("```"):
                result_text = re.sub(r"^```(?:json)?\n?", "", result_text)
                result_text = re.sub(r"\n?```$", "", result_text)

            parsed = json.loads(result_text)

            # Normalize the page_number field
            parsed["page_number"] = page_number

            tx_count = len(parsed.get("transactions", []))
            logger.info(
                f"[StatementParser] Page {page_number}: {tx_count} transaction(s) extracted"
            )
            return parsed

        except Exception as e:
            logger.error(f"[StatementParser] LLM failed for page {page_number}: {e}")
            return None

    def _extract_account_info_llm(self, header_text: str) -> Dict[str, str]:
        """Extract account metadata via a dedicated LLM call on the header section."""
        try:
            prompt = HEADER_PROMPT + header_text

            response = self._gemini_model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.0,
                    "response_mime_type": "application/json",
                }
            )

            result_text = response.text.strip()
            if result_text.startswith("```"):
                result_text = re.sub(r"^```(?:json)?\n?", "", result_text)
                result_text = re.sub(r"\n?```$", "", result_text)

            parsed = json.loads(result_text)
            logger.info(f"[StatementParser] Account info extracted: {parsed.get('name', 'N/A')}")
            return parsed

        except Exception as e:
            logger.warning(f"[StatementParser] LLM header extraction failed: {e}")
            return {"name": "", "account_number": "", "bank": "", "period": ""}

    # ─────────────────────────────────────────────────────────────
    # Regex Fallback Parser (unchanged, for when no API key)
    # ─────────────────────────────────────────────────────────────

    def _parse_with_regex(self, raw_text: str) -> Dict[str, Any]:
        """
        Regex-based fallback parser for common Indian bank statement formats.
        Handles SBI, HDFC, ICICI, PNB style statements.
        """
        logger.info("[StatementParser] Using regex fallback parser")

        account_info = self._extract_account_info_regex(raw_text)
        pages = self._extract_pages(raw_text)

        return {
            "account_info": account_info,
            "pages": pages,
        }

    def _extract_account_info_regex(self, text: str) -> Dict[str, str]:
        """Extract account metadata from statement headers via regex."""
        info = {"name": "", "account_number": "", "bank": "", "period": ""}

        # Account number patterns
        acc_match = re.search(r"(?:A/?c\s*(?:No\.?|Number)|Account\s*(?:No\.?|Number))\s*[:\-]?\s*(\d[\d\s\-]{5,20}\d)", text, re.IGNORECASE)
        if acc_match:
            info["account_number"] = re.sub(r"\s", "", acc_match.group(1))

        # Bank name
        for bank in ["State Bank of India", "SBI", "HDFC Bank", "ICICI Bank", "Punjab National Bank",
                      "PNB", "Canara Bank", "Bank of Baroda", "Union Bank", "Axis Bank",
                      "Kotak Mahindra", "IndusInd", "Yes Bank", "Federal Bank", "IDBI Bank"]:
            if bank.lower() in text.lower():
                info["bank"] = bank
                break

        # Period
        period_match = re.search(
            r"(?:Statement\s+(?:Period|From)|Period|From)\s*[:\-]?\s*"
            r"(\d{1,2}[\-/]\w{3,9}[\-/]\d{2,4})\s*(?:to|[-–])\s*(\d{1,2}[\-/]\w{3,9}[\-/]\d{2,4})",
            text, re.IGNORECASE
        )
        if period_match:
            info["period"] = f"{period_match.group(1)} to {period_match.group(2)}"

        # Account holder name (stopping at subsequent labels if on same line)
        name_match = re.search(
            r"(?:Name|Account\s*Holder|Customer\s*Name)\s*[:\-]?\s*(.+?)(?:\s+(?:Statement\s+Period|Account\s+Number|A/c|Opening|Closing)|[\r\n]|$)",
            text, re.IGNORECASE
        )
        if name_match:
            info["name"] = name_match.group(1).strip()

        return info

    def _extract_pages(self, text: str) -> List[Dict[str, Any]]:
        """Extract page-wise transaction data using regex patterns."""
        # Split by page markers if present
        page_sections = re.split(r"---\s*PAGE\s+(\d+)\s*---", text)

        pages = []
        tx_counter = 1

        if len(page_sections) <= 1:
            transactions = self._extract_transactions(text, tx_counter)
            if transactions:
                op_m = re.search(r"Opening Balance[^\d]*([\d,]+\.?\d*)", text, re.IGNORECASE)
                op_val = self._parse_indian_number(op_m.group(1)) if op_m else (transactions[0]["balance"] - transactions[0]["credit"] + transactions[0]["debit"])
                pages.append({
                    "page_number": 1,
                    "opening_balance": round(op_val, 2),
                    "closing_balance": transactions[-1]["balance"],
                    "transactions": transactions,
                })
            return pages

        i = 1
        while i < len(page_sections):
            page_num_str = page_sections[i]
            page_text = page_sections[i + 1] if i + 1 < len(page_sections) else ""
            
            # Check for explicit page number in footer like "Page X of Y"
            p_footer = re.search(r"Page\s+(\d+)\s+of", page_text, re.IGNORECASE)
            page_num = int(p_footer.group(1)) if p_footer else int(page_num_str)

            transactions = self._extract_transactions(page_text, tx_counter)
            tx_counter += len(transactions)

            if transactions:
                op_m = re.search(r"Opening Balance[^\d]*([\d,]+\.?\d*)", page_text, re.IGNORECASE)
                op_val = self._parse_indian_number(op_m.group(1)) if op_m else (transactions[0]["balance"] - transactions[0]["credit"] + transactions[0]["debit"])
                pages.append({
                    "page_number": page_num,
                    "opening_balance": round(op_val, 2),
                    "closing_balance": transactions[-1]["balance"],
                    "transactions": transactions,
                })
            i += 2

        return pages

    def _extract_transactions(self, text: str, start_id: int = 1) -> List[Dict[str, Any]]:
        """Extract transaction rows from a text block with column order detection."""
        transactions = []
        lines = [line.strip() for line in text.splitlines() if line.strip()]

        # Detect column order (Debit first vs Credit first) from table headers
        debit_first = True
        for line in lines:
            line_lower = line.lower()
            if ("withdrawal" in line_lower or "debit" in line_lower) and ("deposit" in line_lower or "credit" in line_lower):
                dr_pos = min([line_lower.find(w) for w in ["withdrawal", "debit"] if w in line_lower])
                cr_pos = min([line_lower.find(w) for w in ["deposit", "credit"] if w in line_lower])
                debit_first = dr_pos < cr_pos
                break

        # Line-by-line extraction: line starting with date
        for line in lines:
            # Skip header lines that contain column definitions
            if any(h in line.lower() for h in ["balance (inr)", "statement period", "account number", "account name"]):
                continue

            m = re.match(
                r"^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})\s+(.*)",
                line
            )
            if m:
                date_str = m.group(1)
                rest = m.group(2)
                # Find monetary amounts at the end of the line
                amount_matches = list(re.finditer(r"[\d,]+\.\d{2}", rest))
                if len(amount_matches) >= 3:
                    last3 = amount_matches[-3:]
                    narration = rest[:last3[0].start()].strip()
                    val1 = self._parse_indian_number(last3[0].group())
                    val2 = self._parse_indian_number(last3[1].group())
                    bal = self._parse_indian_number(last3[2].group())

                    debit = val1 if debit_first else val2
                    credit = val2 if debit_first else val1

                    transactions.append({
                        "tx_id": f"TX_{start_id + len(transactions):03d}",
                        "date": self._normalize_date(date_str),
                        "narration": narration.strip(),
                        "debit": debit,
                        "credit": credit,
                        "balance": bal,
                    })

        # Fallback to multi-space/pipe regex if line-by-line found nothing
        if not transactions:
            patterns = [
                re.compile(
                    r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}[-/]\w{3}[-/]\d{2,4})"
                    r"\s*\|?\s*(.+?)\s*\|?\s*"
                    r"([\d,]+\.?\d*)\s*\|?\s*([\d,]+\.?\d*)\s*\|?\s*([\d,]+\.?\d*)",
                    re.MULTILINE
                )
            ]
            for pattern in patterns:
                matches = pattern.findall(text)
                if matches:
                    for idx, match in enumerate(matches):
                        date_str, narration, val1, val2, val3 = match
                        # Avoid header matches
                        if "balance" in narration.lower() or "narration" in narration.lower():
                            continue
                        date_normalized = self._normalize_date(date_str)
                        v1 = self._parse_indian_number(val1)
                        v2 = self._parse_indian_number(val2)
                        v3 = self._parse_indian_number(val3)

                        debit = v1 if debit_first else v2
                        credit = v2 if debit_first else v1

                        transactions.append({
                            "tx_id": f"TX_{start_id + idx:03d}",
                            "date": date_normalized,
                            "narration": narration.strip(),
                            "debit": debit,
                            "credit": credit,
                            "balance": v3,
                        })
                    break

        return transactions

    def _normalize_date(self, date_str: str) -> str:
        """Convert various date formats to YYYY-MM-DD."""
        import datetime

        formats = [
            "%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y",
            "%d-%b-%Y", "%d/%b/%Y", "%d-%b-%y", "%d/%b/%y",
            "%d-%B-%Y", "%d/%B/%Y",
            "%Y-%m-%d", "%Y/%m/%d",
        ]
        for fmt in formats:
            try:
                dt = datetime.datetime.strptime(date_str.strip(), fmt)
                if dt.year < 100:
                    dt = dt.replace(year=dt.year + 2000)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
        return date_str  # Return as-is if no format matches

    def _parse_indian_number(self, num_str: str) -> float:
        """Parse Indian-format numbers: 1,23,456.78 → 123456.78"""
        try:
            cleaned = num_str.replace(",", "").strip()
            return float(cleaned) if cleaned else 0.0
        except ValueError:
            return 0.0

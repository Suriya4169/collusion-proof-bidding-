"""
Generate synthetic PDF bank statements from JSON definitions.

Creates:
1. sample_legitimate_statement.pdf (Clean, legitimate 6-month statement)
2. sample_manipulated_statement.pdf (Tampered statement with arithmetic errors, round-trips, and missing page)
3. sample_encrypted_statement.pdf (Encrypted version with password: "password123")

Usage:
    cd <project root>
    python samples/generate_sample_pdfs.py
"""

import json
from pathlib import Path
import pymupdf as fitz

SAMPLES_DIR = Path(__file__).resolve().parent


def format_inr(val: float) -> str:
    """Format a float as an Indian or standard currency string."""
    if val == 0.0:
        return "0.00"
    return f"{val:,.2f}"


def build_bank_statement_pdf(
    json_path: Path,
    output_pdf_path: Path,
    password: str = None
):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    account_info = data.get("account_info", {})
    pages_data = data.get("pages", [])

    doc = fitz.open()

    for p_idx, page_info in enumerate(pages_data):
        page_num = page_info.get("page_number", p_idx + 1)
        page = doc.new_page(width=595, height=842)  # Standard A4 size

        # Colors
        bank_name = account_info.get("bank", "Bank Statement")
        primary_color = (0.05, 0.25, 0.55) if "State Bank" in bank_name else (0.08, 0.18, 0.36)
        accent_color = (0.2, 0.4, 0.7)
        light_bg = (0.94, 0.96, 0.98)
        border_color = (0.8, 0.85, 0.9)

        # Header Banner
        page.draw_rect(fitz.Rect(36, 36, 559, 100), fill=primary_color, color=None)
        page.insert_text(
            (50, 65),
            f"{bank_name.upper()}",
            fontsize=18,
            color=(1, 1, 1),
            fontname="helv",
        )
        page.insert_text(
            (50, 85),
            "OFFICIAL ACCOUNT STATEMENT OF TRANSACTIONS",
            fontsize=9,
            color=(0.85, 0.9, 1),
            fontname="helv",
        )

        # Account Details Box
        page.draw_rect(fitz.Rect(36, 110, 559, 175), fill=light_bg, color=border_color, width=0.8)

        # Left Column Details
        page.insert_text((50, 130), f"Account Name: {account_info.get('name', 'N/A')}", fontsize=9, fontname="helv")
        page.insert_text((50, 146), f"Account Number: {account_info.get('account_number', 'N/A')}", fontsize=9, fontname="helv")
        page.insert_text((50, 162), f"Currency: INR (Indian Rupee)", fontsize=9, fontname="helv")

        # Right Column Details
        page.insert_text((320, 130), f"Statement Period: {account_info.get('period', 'N/A')}", fontsize=9, fontname="helv")
        page.insert_text((320, 146), f"Opening Balance (Page): INR {format_inr(page_info.get('opening_balance', 0.0))}", fontsize=9, fontname="helv")
        page.insert_text((320, 162), f"Closing Balance (Page): INR {format_inr(page_info.get('closing_balance', 0.0))}", fontsize=9, fontname="helv")

        # Table Column Geometry
        cols = [
            ("Date", 36, 100),
            ("Txn ID", 100, 160),
            ("Narration / Description", 160, 340),
            ("Withdrawal (Dr)", 340, 415),
            ("Deposit (Cr)", 415, 485),
            ("Balance (INR)", 485, 559),
        ]

        table_top = 195
        row_height = 24

        # Table Header Row
        page.draw_rect(fitz.Rect(36, table_top, 559, table_top + row_height), fill=accent_color, color=border_color, width=0.8)
        for col_name, c_start, c_end in cols:
            page.insert_text((c_start + 4, table_top + 16), col_name, fontsize=8, color=(1, 1, 1), fontname="helv")

        # Table Rows
        curr_y = table_top + row_height
        tx_list = page_info.get("transactions", [])

        for r_idx, tx in enumerate(tx_list):
            row_rect = fitz.Rect(36, curr_y, 559, curr_y + row_height)
            bg = (0.98, 0.99, 1.0) if r_idx % 2 == 0 else (1.0, 1.0, 1.0)
            page.draw_rect(row_rect, fill=bg, color=border_color, width=0.5)

            # Insert cell values
            date_val = tx.get("date", "")
            tx_id_val = tx.get("tx_id", "")
            narr_val = tx.get("narration", "")[:32]  # Truncate if long
            debit_val = format_inr(tx.get("debit", 0.0)) if tx.get("debit", 0.0) > 0 else "0.00"
            credit_val = format_inr(tx.get("credit", 0.0)) if tx.get("credit", 0.0) > 0 else "0.00"
            bal_val = format_inr(tx.get("balance", 0.0))

            text_y = curr_y + 16
            page.insert_text((36 + 4, text_y), str(date_val), fontsize=8, color=(0.1, 0.1, 0.1), fontname="helv")
            page.insert_text((100 + 4, text_y), str(tx_id_val), fontsize=8, color=(0.2, 0.2, 0.2), fontname="helv")
            page.insert_text((160 + 4, text_y), str(narr_val), fontsize=8, color=(0.1, 0.1, 0.1), fontname="helv")
            page.insert_text((340 + 4, text_y), str(debit_val), fontsize=8, color=(0.6, 0.1, 0.1) if tx.get("debit", 0.0) > 0 else (0.4, 0.4, 0.4), fontname="helv")
            page.insert_text((415 + 4, text_y), str(credit_val), fontsize=8, color=(0.1, 0.5, 0.1) if tx.get("credit", 0.0) > 0 else (0.4, 0.4, 0.4), fontname="helv")
            page.insert_text((485 + 4, text_y), str(bal_val), fontsize=8, color=(0.0, 0.0, 0.0), fontname="helv")

            curr_y += row_height

        # Table Column Dividers
        for _, c_start, _ in cols[1:]:
            page.draw_line(fitz.Point(c_start, table_top), fitz.Point(c_start, curr_y), color=border_color, width=0.5)

        # Footer
        footer_y = 800
        page.draw_line(fitz.Point(36, footer_y), fitz.Point(559, footer_y), color=border_color, width=0.8)
        page.insert_text(
            (50, footer_y + 16),
            "Computer Generated Statement — No Physical Signature Required. Audit-Grade Ledger Tracked.",
            fontsize=7,
            color=(0.5, 0.5, 0.5),
            fontname="helv",
        )
        page.insert_text(
            (480, footer_y + 16),
            f"Page {page_num} of {len(pages_data)}",
            fontsize=8,
            color=(0.3, 0.3, 0.3),
            fontname="helv",
        )

    # Save document (encrypted if password specified)
    if password:
        doc.save(
            str(output_pdf_path),
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw=password,
            owner_pw=password + "_admin"
        )
        print(f"[OK] Generated encrypted PDF: {output_pdf_path} (Password: '{password}')")
    else:
        doc.save(str(output_pdf_path))
        print(f"[OK] Generated PDF: {output_pdf_path}")

    doc.close()


def main():
    legit_json = SAMPLES_DIR / "sample_legitimate_statement.json"
    manip_json = SAMPLES_DIR / "sample_manipulated_statement.json"

    legit_pdf = SAMPLES_DIR / "sample_legitimate_statement.pdf"
    manip_pdf = SAMPLES_DIR / "sample_manipulated_statement.pdf"
    encrypted_pdf = SAMPLES_DIR / "sample_encrypted_statement.pdf"

    if legit_json.exists():
        build_bank_statement_pdf(legit_json, legit_pdf)
        # Also build encrypted version with password "password123"
        build_bank_statement_pdf(legit_json, encrypted_pdf, password="password123")

    if manip_json.exists():
        build_bank_statement_pdf(manip_json, manip_pdf)


if __name__ == "__main__":
    main()

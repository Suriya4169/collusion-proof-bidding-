"""
Solvency Verification Agent — Core Orchestrator

This is the main agent class that orchestrates the full pipeline:
  PDF Upload → Text Extraction → LLM Layout Mapping → Structured JSON
  → Ledger-Constrained Verification → Financial Metrics → Audit Report

Designed as a self-contained, callable agent with a clean interface
for integration with other agents via REST endpoints.
"""

import logging
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Add parent project directory to path so we can import the original ledger_verifier
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.pdf_extractor import PDFExtractor, PDFPasswordError, PDFExtractionError
from app.services.statement_parser import StatementParser
from app.models.schemas import (
    AnalysisResponse,
    AuditRow,
    ExtractionMetadata,
    FinancialMetrics,
    IntegrityVerdict,
    StatementData,
    VerificationFlag,
)

# Import the existing ledger verifier from the project root
from ledger_verifier import LedgerConstraintVerifier

logger = logging.getLogger("solvency_agent")


class SolvencyVerificationAgent:
    """
    Agent 3: FinTech Solvency Verification Agent

    Capabilities:
    - PDF bank statement extraction (text-layer routing)
    - LLM-based layout mapping (Gemini, layout-only, numbers from text)
    - Ledger-constrained verification (row recurrence, page continuity)
    - Manipulation detection (window dressing, round-trips, Benford's)
    - Financial metrics computation (TWAB, min balance, volatility, slope)

    Integration:
    - Callable via REST API (FastAPI + Swagger)
    - Results cached in-memory by analysis_id
    - Health endpoint for orchestrator discovery
    """

    AGENT_NAME = "solvency_verification_agent"
    AGENT_VERSION = "1.0.0"

    def __init__(self, gemini_api_key: Optional[str] = None):
        self.gemini_api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY")
        self.pdf_extractor = PDFExtractor()
        self.statement_parser = StatementParser(gemini_api_key=self.gemini_api_key)
        self.ledger_verifier = LedgerConstraintVerifier(
            tolerance=0.05,
            window_dressing_threshold=3.0,
        )

        # In-memory results store (keyed by analysis_id)
        self._results_cache: Dict[str, AnalysisResponse] = {}

        logger.info(f"[{self.AGENT_NAME}] Agent initialized (v{self.AGENT_VERSION})")

    # ─────────────────────────────────────────────────────────
    # Main Pipeline: PDF → Full Analysis
    # ─────────────────────────────────────────────────────────

    def analyze_pdf(
        self,
        pdf_bytes: bytes,
        filename: str = "uploaded.pdf",
        gemini_api_key: Optional[str] = None,
        password: Optional[str] = None,
    ) -> AnalysisResponse:
        """
        Full pipeline: PDF bytes → extraction → structuring → verification → scoring.

        This is the primary entry point for the agent.
        """
        analysis_id = str(uuid.uuid4())[:12]
        logger.info(f"[{self.AGENT_NAME}] Starting analysis {analysis_id} for '{filename}'")

        try:
            # Step 1: Extract raw text from PDF (with optional password decryption)
            raw_text, extract_meta = self.pdf_extractor.extract(
                pdf_bytes, filename, password=password
            )

            if not raw_text or len(raw_text.strip()) < 20:
                return self._build_error_response(
                    analysis_id, filename,
                    "PDF extraction yielded insufficient text. The PDF may be image-only (scanned). "
                    "Please ensure the PDF has a text layer or submit a pre-structured JSON via /verify-json."
                )

            # Step 2: Parse extracted text into structured JSON
            effective_key = gemini_api_key or self.gemini_api_key
            structured_data, llm_time_ms = self.statement_parser.parse(raw_text, api_key=effective_key)
            extract_meta["llm_structuring_time_ms"] = llm_time_ms

            if not structured_data or not structured_data.get("pages"):
                return self._build_error_response(
                    analysis_id, filename,
                    "Failed to structure the extracted text into a valid bank statement format. "
                    "The PDF layout may be unsupported. Try submitting via /verify-json with manual structuring."
                )

            # Step 3: Run verification
            return self._run_verification(analysis_id, structured_data, extract_meta)

        except PDFPasswordError as e:
            logger.warning(f"[{self.AGENT_NAME}] Analysis {analysis_id} blocked by password: {e}")
            return self._build_error_response(analysis_id, filename, str(e))
        except PDFExtractionError as e:
            logger.error(f"[{self.AGENT_NAME}] Analysis {analysis_id} extraction error: {e}")
            return self._build_error_response(analysis_id, filename, f"PDF extraction error: {str(e)}")
        except Exception as e:
            logger.error(f"[{self.AGENT_NAME}] Analysis {analysis_id} failed: {e}", exc_info=True)
            return self._build_error_response(analysis_id, filename, f"Internal error: {str(e)}")

    # ─────────────────────────────────────────────────────────
    # Direct JSON Verification (skip PDF extraction)
    # ─────────────────────────────────────────────────────────

    def verify_json(self, statement_data: Dict[str, Any]) -> AnalysisResponse:
        """
        Verify a pre-structured bank statement JSON directly.
        Used when the caller has already extracted and structured the data,
        or for testing with synthetic statements.
        """
        analysis_id = str(uuid.uuid4())[:12]
        logger.info(f"[{self.AGENT_NAME}] Direct JSON verification {analysis_id}")
        return self._run_verification(analysis_id, statement_data, extract_meta=None)

    # ─────────────────────────────────────────────────────────
    # Core Verification Logic
    # ─────────────────────────────────────────────────────────

    def _run_verification(
        self,
        analysis_id: str,
        statement_data: Dict[str, Any],
        extract_meta: Optional[Dict] = None,
    ) -> AnalysisResponse:
        """Run the ledger-constrained verification engine on structured data."""

        # Run the existing verification engine
        result = self.ledger_verifier.verify_statement(statement_data)

        # Map the integrity verdict to enum
        raw_verdict = result.get("overall_integrity", "")
        if "FAILED" in raw_verdict:
            verdict = IntegrityVerdict.FAILED
        elif "SUSPICIOUS" in raw_verdict:
            verdict = IntegrityVerdict.SUSPICIOUS
        elif "PASSED" in raw_verdict:
            verdict = IntegrityVerdict.PASSED
        else:
            verdict = IntegrityVerdict.ABSTAINED

        # Build verification flags
        flags = []
        for f in result.get("flags", []):
            flags.append(VerificationFlag(
                type=f.get("type", "UNKNOWN"),
                severity=f.get("severity", "MEDIUM"),
                details=f.get("details", ""),
                tx_id=f.get("tx_id"),
                date=f.get("date"),
                extra={k: v for k, v in f.items() if k not in ("type", "severity", "details", "tx_id", "date")},
            ))

        # Build audit rows
        audit_rows = []
        for row in result.get("sample_audit_rows", []):
            audit_rows.append(AuditRow(
                tx_id=row.get("tx_id", ""),
                date=row.get("date"),
                narration=row.get("narration"),
                debit=row.get("debit", 0.0),
                credit=row.get("credit", 0.0),
                reported_balance=row.get("reported_balance", 0.0),
                verified_balance=row.get("verified_balance", 0.0),
                expected_balance=row.get("expected_balance", 0.0),
                residual=row.get("residual", 0.0),
                status=row.get("status", "VALID"),
                note=row.get("note"),
            ))

        # Build financial metrics
        fm = result.get("financial_metrics", {})
        financial_metrics = FinancialMetrics(
            time_weighted_avg_balance=fm.get("time_weighted_avg_balance", 0.0),
            naive_transaction_avg_balance=fm.get("naive_transaction_avg_balance", 0.0),
            min_balance=fm.get("min_balance", 0.0),
            max_balance=fm.get("max_balance", 0.0),
            balance_volatility_cv=fm.get("balance_volatility_cv", 0.0),
            monthly_cashflow_slope=fm.get("monthly_cashflow_slope", 0.0),
        )

        # Build extraction metadata if available
        extraction = None
        if extract_meta:
            extraction = ExtractionMetadata(
                pdf_filename=extract_meta.get("pdf_filename", "unknown"),
                total_pages=extract_meta.get("total_pages", 0),
                has_text_layer=extract_meta.get("has_text_layer", False),
                password_protected=extract_meta.get("password_protected", False),
                extraction_method=extract_meta.get("extraction_method", "unknown"),
                extraction_time_ms=extract_meta.get("extraction_time_ms", 0),
                llm_structuring_time_ms=extract_meta.get("llm_structuring_time_ms", 0),
            )

        # Build structured statement for response
        structured_statement = None
        try:
            structured_statement = StatementData(**statement_data)
        except Exception:
            pass  # Non-critical: structured data may not perfectly match schema

        # Assemble final response
        response = AnalysisResponse(
            analysis_id=analysis_id,
            timestamp=datetime.utcnow().isoformat(),
            extraction=extraction,
            structured_statement=structured_statement,
            overall_integrity=verdict,
            total_transactions_analyzed=result.get("total_transactions_analyzed", 0),
            flags_raised_count=result.get("flags_raised_count", 0),
            flags=flags,
            financial_metrics=financial_metrics,
            window_dressing_z_score=result.get("window_dressing_z_score"),
            benford_divergence=result.get("benford_divergence"),
            audit_rows=audit_rows,
            account_holder=result.get("account_holder"),
            account_number=result.get("account_number"),
            bank_name=result.get("bank_name"),
            statement_period=result.get("statement_period"),
        )

        # Cache the result
        self._results_cache[analysis_id] = response
        logger.info(f"[{self.AGENT_NAME}] Analysis {analysis_id} completed: {verdict.value}")

        return response

    # ─────────────────────────────────────────────────────────
    # Utility Methods
    # ─────────────────────────────────────────────────────────

    def get_result(self, analysis_id: str) -> Optional[AnalysisResponse]:
        """Retrieve a cached analysis result by ID."""
        return self._results_cache.get(analysis_id)

    def list_results(self) -> list[str]:
        """List all cached analysis IDs."""
        return list(self._results_cache.keys())

    def _build_error_response(self, analysis_id: str, filename: str, error_msg: str) -> AnalysisResponse:
        """Build an ABSTAINED response for error/failure cases."""
        return AnalysisResponse(
            analysis_id=analysis_id,
            timestamp=datetime.utcnow().isoformat(),
            extraction=ExtractionMetadata(pdf_filename=filename),
            overall_integrity=IntegrityVerdict.ABSTAINED,
            total_transactions_analyzed=0,
            flags_raised_count=1,
            flags=[VerificationFlag(
                type="EXTRACTION_FAILURE",
                severity="CRITICAL",
                details=error_msg,
            )],
        )

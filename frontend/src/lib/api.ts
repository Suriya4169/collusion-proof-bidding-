/**
 * ProcureGuard-AI API client.
 * All requests target the FastAPI backend on port 8000 and surface
 * operator-friendly error messages instead of raw fetch failures.
 */

export const API_BASE = "http://localhost:8000";

export class ApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiResult<T> {
  data: T;
  status: number;
  latencyMs: number;
}

interface FastApiErrorBody {
  detail?: string | { msg?: string; message?: string }[] | { message?: string };
  message?: string;
}

function describeBody(body: FastApiErrorBody | null, fallback: string): string {
  if (!body) return fallback;
  const d = body.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => e.msg ?? e.message ?? "validation error").join("; ");
  if (d && typeof d === "object" && "message" in d && d.message) return d.message;
  return body.message ?? fallback;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(
      `Cannot reach the ProcureGuard API at ${API_BASE}. Start the backend (uvicorn src.main:app --port 8000) and retry.`,
    );
  }
  const latencyMs = Math.round(performance.now() - started);

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new ApiError(
      describeBody(body as FastApiErrorBody | null, `Server returned HTTP ${res.status} ${res.statusText}`),
      res.status,
    );
  }
  return { data: body as T, status: res.status, latencyMs };
}

export function errorMessage(err: unknown, fallback = "Unexpected error."): string {
  return err instanceof Error ? err.message : fallback;
}

// ───────────────────────── Formatting helpers ─────────────────────────

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatINR(value: number, whole = false): string {
  return (whole ? inrWhole : inr).format(value);
}

/** ₹ amount expressed in lakhs (1 lakh = 1,00,000). */
export function formatLakhs(lakhs: number): string {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
  return `₹${lakhs.toFixed(2)} L`;
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ───────────────────────── Response schemas ─────────────────────────

export type RuleStatus = "PASS" | "FAIL" | "EXEMPTED" | "INFO";

export interface RuleVerification {
  ruleName: string;
  status: RuleStatus;
  requiredValue: string;
  actualValue: string;
  distancePct: number;
  confidence: number;
  sourcePage: number;
  message: string;
}

/** POST /api/tender/analyze */
export interface VerificationReport {
  isEligible: boolean;
  overallComplianceScore: number;
  checks: RuleVerification[];
  missingDocuments: string[];
  plainSummary: string;
  regionalSummary: string;
  recommendedSchemes: string[];
  reasoning: string[];
}

/** POST /api/payments/track */
export interface PaymentPenaltyReport {
  daysOverdue: number;
  isPenaltyApplicable: boolean;
  penaltyAmountInr: number;
  demandNoticeDraft: string;
}

/** POST /api/diff */
export interface FlaggedClause {
  original_clause: string;
  amended_clause: string;
  similarity_score: number;
  classification: string;
  reason: string;
  base_risk_score: number;
}

export interface DiffReportData {
  overall_manipulation_probability: number;
  risk_level: string;
  flagged_clauses: FlaggedClause[];
  days_before_deadline: number;
  temporal_multiplier: number;
}

/** GET /api/cartel/* */
export interface Bidder {
  bidder_id: string;
  name: string;
  beneficial_owners: { name: string }[];
  submission_metadata: { ip_address?: string; bank_routing_code?: string };
  declared_assets: string[];
}

export interface BiddersResponse {
  bidders: Bidder[];
  count: number;
}

export interface CartelSummary {
  cartel_detected: boolean;
  flagged_networks: { bidders: string[]; reason: string }[];
  anomaly_scores: Record<string, number>;
}

export interface GraphRenderPayload {
  bidders: { id: string; name: string }[];
  metadata: { id: string; kind: string; label: string; detail: string }[];
  bipartite: [string, string][];
  anomalyScores: Record<string, number>;
}

/** POST /api/behavior/analyze */
export interface BehaviorResponse {
  session_id: string;
  status: string;
  scoring_mode: string;
  behavioral_risk_score?: number;
  risk_category?: string;
  behavioral_anomaly?: boolean;
  reliability?: "low" | "medium" | "high";
  events_received: number;
  events_scored: number;
  behavioral_evidence: string[];
  model_version: string;
  message?: string;
}

/** GET /api/matchmaker/{id} */
export interface MatchTender {
  tender_id: string;
  title: string;
  category: string;
  min_turnover_lakhs: number;
  min_experience_years?: number;
  estimated_value_inr?: string;
  submission_deadline?: string;
}

export interface MatchmakerDashboard {
  msme_profile: {
    msme_id?: string;
    company_name: string;
    sector: string;
    annual_turnover_lakhs: number;
    years_of_experience: number;
    udyam_number?: string;
  };
  solo_opportunities: { count: number; tenders: { tender: MatchTender; score: number }[] };
  joint_venture_opportunities: {
    count: number;
    tenders: {
      tender: MatchTender;
      recommended_partner: { partner_id: string; partner_name: string; combined_turnover: number; match_score: number };
    }[];
  };
  missed_opportunities: { count: number; tenders: unknown[] };
}

export interface MsmeSummary {
  msme_id: string;
  company_name: string;
  sector?: string;
  annual_turnover_lakhs?: number;
  years_of_experience?: number;
  udyam_number?: string;
}

/** GET /api/documents/{id} */
export interface VaultDoc {
  id: number | null;
  document_type: string;
  file_name: string | null;
  upload_date: string | null;
  expiry_date: string | null;
  status: string;
  is_uploaded: boolean;
}

export interface VaultData {
  msme_id: string;
  readiness_score: number;
  total_documents_uploaded: number;
  total_required: number;
  vault_documents: VaultDoc[];
  missing_documents: string[];
  proactive_alerts: string[];
}

/** GET /health */
export interface HealthResponse {
  status: string;
  message: string;
  modules: string[];
}

/** POST /api/orchestrator/analyze */
export interface OrchestratorResponse {
  verification_report: Record<string, unknown> | null;
  plain_summary: string;
  regional_summary: string;
  recommended_schemes: string[];
  orchestration_logs: string[];
}

/** /api/m2m/v1/* */
export interface M2MTenderPush {
  tender_id: string;
  title: string;
  department: string;
  category: string;
  estimated_value_inr: string;
  emd_amount_inr: number;
  min_turnover_lakhs: number;
  min_experience_years: number;
  allows_startup_exemption: boolean;
  submission_deadline: string;
}

export interface M2MPushResponse {
  status: "SUCCESS" | "EXISTS";
  message: string;
  tender: Record<string, unknown>;
}

/** GET /api/tenders */
export interface Tender {
  tender_id: string;
  title: string;
  department: string;
  category: string;
  min_turnover_lakhs: number;
  min_experience_years: number;
  required_certifications?: string[];
  allows_startup_exemption: boolean;
  emd_amount_inr: number;
  estimated_value_inr: string;
  submission_deadline: string;
  description?: string;
  status: string;
}

export interface TendersResponse {
  total_count: number;
  available_categories: string[];
  tenders: Tender[];
}

export interface TenderFilters {
  category: string;
  search: string;
}

export const ALL_SECTORS = "All";

/** POST /api/tenders/upload-pdf */
export interface TenderUploadResponse {
  message?: string;
  tender?: Tender;
}

/** POST /api/msme/register */
export interface MsmeRegistrationPayload {
  company_name: string;
  sector: string;
  annual_turnover_lakhs: number;
  years_of_experience: number;
  udyam_number: string;
  gstin: string;
  email: string;
  is_startup_india_recognized: boolean;
  certifications: string[];
}

export interface MsmeRegistrationResponse {
  message?: string;
  msme_id: string;
}

/** POST /api/auth/login */
export type UserRole = "msme" | "government_auditor" | "admin";

export interface AuthUser {
  email: string;
  full_name?: string;
  role: UserRole;
  msme_id?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export type Persona = "vendor" | "auditor";
export const PERSONA_STORAGE_KEY = "pg_persona";
export const personaForRole = (role: UserRole): Persona => (role === "msme" ? "vendor" : "auditor");

/** GET /api/notifications/{msme_id}: proactive match alerts pushed by the match notifier daemon */
export interface MatchNotification {
  id: number;
  msme_id: string;
  tender_id: string;
  kind: "SOLO" | "JV";
  score: number;
  title: string;
  message: string;
  partner_name: string | null;
  created_at: string;
  read: boolean;
}

export interface NotificationsResponse {
  msme_id: string;
  unread_count: number;
  notifications: MatchNotification[];
}

export const ACTIVE_MSME_KEY = "active_msme_id";
export const DEFAULT_MSME_ID = "M101";

export function getActiveMsmeId(): string {
  try {
    return localStorage.getItem(ACTIVE_MSME_KEY) || DEFAULT_MSME_ID;
  } catch {
    return DEFAULT_MSME_ID;
  }
}

export function setActiveMsmeId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_MSME_KEY, id);
  } catch {
    /* storage unavailable: the alert bell keeps the default enterprise */
  }
  window.dispatchEvent(new Event("pg-active-msme"));
}

/** Agent 3 · /api/v1/agent/solvency/* */
export type IntegrityVerdict =
  | "PASSED (AUTHENTIC_AND_CONSISTENT)"
  | "SUSPICIOUS (MANIPULATION_FLAGS_RAISED)"
  | "FAILED (POTENTIAL_TAMPERING_DETECTED)"
  | "ABSTAINED (INSUFFICIENT_CONFIDENCE)";

export type LedgerRowStatus = "VALID" | "CORRECTED_OCR_ERROR" | "UNEXPLAINABLE_RESIDUAL";

export interface StatementTransaction {
  tx_id: string;
  date: string;
  narration?: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface StatementPage {
  page_number: number;
  opening_balance: number;
  closing_balance: number;
  transactions: StatementTransaction[];
}

export interface StatementData {
  account_info: { name?: string | null; account_number?: string | null; bank?: string | null; period?: string | null };
  pages: StatementPage[];
}

export interface SolvencyFlag {
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  details: string;
  tx_id?: string | null;
  date?: string | null;
  extra?: Record<string, unknown> | null;
}

export interface SolvencyAuditRow {
  tx_id: string;
  date?: string | null;
  narration?: string | null;
  debit: number;
  credit: number;
  reported_balance: number;
  verified_balance: number;
  expected_balance: number;
  residual: number;
  status: LedgerRowStatus | string;
  note?: string | null;
}

export interface SolvencyMetrics {
  time_weighted_avg_balance: number;
  naive_transaction_avg_balance: number;
  min_balance: number;
  max_balance: number;
  balance_volatility_cv: number;
  monthly_cashflow_slope: number;
}

export interface SolvencyAnalysis {
  analysis_id: string;
  timestamp: string;
  agent_version: string;
  extraction?: { pdf_filename: string; total_pages: number; extraction_method: string; extraction_time_ms: number; llm_structuring_time_ms: number } | null;
  overall_integrity: IntegrityVerdict;
  total_transactions_analyzed: number;
  flags_raised_count: number;
  flags: SolvencyFlag[];
  financial_metrics: SolvencyMetrics | null;
  window_dressing_z_score: number | null;
  benford_divergence: number | null;
  audit_rows: SolvencyAuditRow[];
  account_holder?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  statement_period?: string | null;
}

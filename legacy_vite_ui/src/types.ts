export type UserRole = 'msme' | 'govt';

export interface MSMEProfile {
  companyName: string;
  udyamNumber: string;
  gstin: string;
  category: 'Micro' | 'Small' | 'Medium';
  annualTurnover: string;
  state: string;
  panNumber: string;
  zedCertified: boolean;
  activeDisputesCount: number;
}

export interface GovtProfile {
  officerName: string;
  officerId: string;
  department: string;
  designation: string;
  clearanceLevel: string;
  zone: string;
}

export interface AnalysisRuleItem {
  id: string;
  ruleName: string;
  category: string;
  status: 'MET' | 'EXEMPTED' | 'CONDITIONAL' | 'UNMET';
  requiredValue: string;
  actualValue: string;
  complianceDistance: string;
  confidenceScore: number;
  sourcePage: string;
  legalExemptionReference?: string;
  detailsNote: string;
}

export interface DetailedTenderAnalysis {
  tenderId: string;
  tenderRef: string;
  title: string;
  authority: string;
  estimatedValue: string;
  submissionDeadline: string;
  verdict: 'ELIGIBLE' | 'PARTIAL' | 'NOT ELIGIBLE';
  score: number;
  msmeExemptionsApplied: string;
  rules: AnalysisRuleItem[];
  missingDocuments: {
    name: string;
    description: string;
    sourcePage: string;
    urgency: 'HIGH' | 'MEDIUM';
    action: string;
  }[];
  plainLanguageSummary: {
    english: string;
    hindi: string;
  };
  recommendedSchemes: {
    id: string;
    name: string;
    benefit: string;
    tag: string;
    relevance: string;
    color: 'emerald' | 'cyan' | 'indigo' | 'amber';
  }[];
}

export interface TenderAnalysisItem {
  id: string;
  tenderRef: string;
  title: string;
  authority: string; // e.g. "Ministry of Railways", "Bharat Heavy Electricals Ltd (BHEL)"
  portal: 'GeM' | 'CPPP' | 'Defence' | 'State e-Proc';
  estimatedValue: string;
  submissionDeadline: string;
  eligibilityStatus: 'Eligible' | 'Conditional' | 'Ineligible';
  matchScore: number; // e.g. 96
  matchSummary: string;
  emdStatus: 'Exempted (MSME)' | 'Required (₹1.2L)' | 'Partial';
  turnoverRequirement: string;
  experienceRequirement: string;
  makeInIndiaPreference: 'Class-I Local Supplier (50%+)' | 'Class-II Local Supplier (20-50%)' | 'Non-Local';
  keyDisqualifierOrAdvantage: string;
  category: string;
}

export interface GovernmentScheme {
  id: string;
  name: string;
  ministry: string;
  benefit: string;
  relevanceScore: number;
  eligibilityTag: string;
  badgeColor: 'emerald' | 'cyan' | 'indigo' | 'amber';
  description: string;
  actionUrl?: string;
}

export interface CriticalAlert {
  id: string;
  tenderRef: string;
  title: string;
  department: string;
  riskPercentage: number;
  riskSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  alertType: 'Corrigendum Tampering' | 'Cartel Ring' | 'Proprietary Spec Lock' | 'IP Clustering' | 'Turnover Manipulation';
  detectedTime: string;
  summary: string;
  tamperEvidence: {
    originalClause: string;
    amendedClause: string;
    hoursBeforeDeadline: number;
    benefitingVendor: string;
    impactScore: string;
  };
  status: 'Investigating' | 'Frozen' | 'Notice Issued' | 'Resolved';
}

export interface ActiveGovtTender {
  id: string;
  tenderRef: string;
  title: string;
  department: string;
  estimatedValue: string;
  totalBids: number;
  corrigendaCount: number;
  integrityScore: number;
  status: 'Open' | 'Under Technical Evaluation' | 'Flagged for Vigilance' | 'Corrigendum Frozen';
}

export interface CartelSuspectGroup {
  id: string;
  ringName: string;
  vendorsCount: number;
  bidsCovered: number;
  collusionType: string;
  confidenceScore: number;
  sharedAttributes: string[];
}

export interface SemanticDiffClause {
  id: string;
  clauseName: string;
  clauseRef: string;
  riskScore: number;
  riskSeverity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  originalText: string;
  changedText: string;
  semanticChangePercentage: number;
  timingBeforeDeadline: string;
  hoursBeforeDeadline: number;
  direction: 'MORE RESTRICTIVE' | 'LESS RESTRICTIVE' | 'NEUTRAL';
  oneLineExplanation: string;
  violationCode?: string;
}

export interface IntegrityAnalysisResult {
  tenderRef: string;
  title: string;
  department: string;
  originalFileName: string;
  corrigendumFileName: string;
  amendmentDate: string;
  tenderDeadline: string;
  daysGap: number;
  isWindowViolated: boolean;
  overallCorruptionRisk: number;
  riskLabel: 'CRITICAL' | 'MODERATE' | 'LOW';
  summaryNote: string;
  clauses: SemanticDiffClause[];
}


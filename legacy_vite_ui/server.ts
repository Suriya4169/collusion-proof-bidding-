import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set in environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Response Schema for MSME Tender Analysis
const tenderAnalysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    tenderId: { type: Type.STRING, description: "Unique identifier or reference ID" },
    tenderRef: { type: Type.STRING, description: "Tender reference code e.g. GEM/2026/B/894102" },
    title: { type: Type.STRING, description: "Procurement title" },
    authority: { type: Type.STRING, description: "Procuring organization/ministry" },
    estimatedValue: { type: Type.STRING, description: "Estimated tender value e.g. ₹72.50 Lakhs" },
    submissionDeadline: { type: Type.STRING, description: "Submission deadline e.g. 24 Sep 2026, 17:00 IST" },
    verdict: {
      type: Type.STRING,
      description: "Final eligibility verdict: must be 'ELIGIBLE', 'PARTIAL', or 'NOT ELIGIBLE'",
    },
    score: { type: Type.NUMBER, description: "Match score out of 100" },
    msmeExemptionsApplied: { type: Type.STRING, description: "Summary of statutory exemptions applied" },
    rules: {
      type: Type.ARRAY,
      description: "Rule by rule compliance breakdown",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          ruleName: { type: Type.STRING, description: "Descriptive name of the rule e.g. Earnest Money Deposit (EMD)" },
          category: { type: Type.STRING, description: "Category: EMD, Turnover, Experience, MakeInIndia, FinancialSolvency, etc." },
          status: {
            type: Type.STRING,
            description: "Status must be 'MET', 'EXEMPTED', 'CONDITIONAL', or 'UNMET'",
          },
          requiredValue: { type: Type.STRING, description: "Value or criterion demanded by tender" },
          actualValue: { type: Type.STRING, description: "Value or status from MSME profile/statutory exemption" },
          complianceDistance: { type: Type.STRING, description: "Distance string e.g. '+100% (Full Waiver)', '+150% (Surplus)', '-20% (Shortfall)'" },
          confidenceScore: { type: Type.NUMBER, description: "Confidence percentage (70 to 100)" },
          sourcePage: { type: Type.STRING, description: "Page and clause in tender document e.g. Page 4, Clause 3.2" },
          legalExemptionReference: { type: Type.STRING, description: "Statutory legal reference e.g. PPP for MSEs Order 2012 / GFR Rule 173(i)" },
          detailsNote: { type: Type.STRING, description: "Detailed contextual explanation" },
        },
        required: [
          "id",
          "ruleName",
          "category",
          "status",
          "requiredValue",
          "actualValue",
          "complianceDistance",
          "confidenceScore",
          "sourcePage",
          "detailsNote",
        ],
      },
    },
    missingDocuments: {
      type: Type.ARRAY,
      description: "Any missing documents or certificates needed before bidding",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          sourcePage: { type: Type.STRING },
          urgency: {
            type: Type.STRING,
            description: "Urgency: 'HIGH' or 'MEDIUM'",
          },
          action: { type: Type.STRING },
        },
        required: ["name", "description", "sourcePage", "urgency", "action"],
      },
    },
    plainLanguageSummary: {
      type: Type.OBJECT,
      description: "Natural language explanation for MSME entrepreneur in English and Hindi",
      properties: {
        english: { type: Type.STRING, description: "Comprehensive, friendly English summary" },
        hindi: { type: Type.STRING, description: "Clear, fluent Hindi (Devanagari) summary" },
      },
      required: ["english", "hindi"],
    },
    recommendedSchemes: {
      type: Type.ARRAY,
      description: "Recommended Government MSME support schemes",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          benefit: { type: Type.STRING },
          tag: { type: Type.STRING },
          relevance: { type: Type.STRING },
          color: {
            type: Type.STRING,
            description: "Badge color: 'emerald', 'cyan', 'indigo', or 'amber'",
          },
        },
        required: ["id", "name", "benefit", "tag", "relevance", "color"],
      },
    },
  },
  required: [
    "tenderId",
    "tenderRef",
    "title",
    "authority",
    "estimatedValue",
    "submissionDeadline",
    "verdict",
    "score",
    "msmeExemptionsApplied",
    "rules",
    "missingDocuments",
    "plainLanguageSummary",
    "recommendedSchemes",
  ],
};

// Response Schema for Government Integrity & Corrigendum Semantic Diff
const semanticDiffResponseSchema = {
  type: Type.OBJECT,
  properties: {
    tenderRef: { type: Type.STRING },
    title: { type: Type.STRING },
    department: { type: Type.STRING },
    overallCorruptionRisk: { type: Type.NUMBER, description: "Risk percentage between 0 and 100" },
    riskLabel: {
      type: Type.STRING,
      description: "Must be 'CRITICAL', 'MODERATE', or 'LOW'",
    },
    summaryNote: { type: Type.STRING, description: "Executive summary for Chief Procurement Vigilance Officer" },
    clauses: {
      type: Type.ARRAY,
      description: "List of analyzed clause differences and semantic shifts",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          clauseName: { type: Type.STRING, description: "e.g. Clause 4.2: Bidder Eligibility & MSME Inclusivity" },
          clauseRef: { type: Type.STRING, description: "e.g. Section II, Clause 4.2 (Page 7)" },
          riskScore: { type: Type.NUMBER, description: "Risk score for this clause (0-100)" },
          riskSeverity: {
            type: Type.STRING,
            description: "Must be 'CRITICAL', 'HIGH', 'MODERATE', or 'LOW'",
          },
          originalText: { type: Type.STRING, description: "Original tender RFP clause text" },
          changedText: { type: Type.STRING, description: "Amended corrigendum clause text" },
          semanticChangePercentage: { type: Type.NUMBER, description: "Percentage semantic distance (0-100)" },
          timingBeforeDeadline: { type: Type.STRING, description: "e.g. 48 hours before the deadline" },
          hoursBeforeDeadline: { type: Type.NUMBER, description: "Hours remaining before bid cutoff" },
          direction: {
            type: Type.STRING,
            description: "Must be 'MORE RESTRICTIVE', 'LESS RESTRICTIVE', or 'NEUTRAL'",
          },
          oneLineExplanation: { type: Type.STRING, description: "Clear vigilance finding explanation" },
          violationCode: { type: Type.STRING, description: "Statutory or circular code e.g. CVC-VIG-2012-PPP-VIOLATION" },
        },
        required: [
          "id",
          "clauseName",
          "clauseRef",
          "riskScore",
          "riskSeverity",
          "originalText",
          "changedText",
          "semanticChangePercentage",
          "timingBeforeDeadline",
          "hoursBeforeDeadline",
          "direction",
          "oneLineExplanation",
        ],
      },
    },
  },
  required: [
    "tenderRef",
    "title",
    "department",
    "overallCorruptionRisk",
    "riskLabel",
    "summaryNote",
    "clauses",
  ],
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // MSME Tender Analysis Endpoint
  app.post("/api/analyze-tender", async (req, res) => {
    try {
      const { tenderText, msmeProfile, tenderTitle, tenderRef, fileName } = req.body;

      if (!tenderText || !msmeProfile) {
        return res.status(400).json({
          error: "Missing required fields: 'tenderText' and 'msmeProfile' are mandatory.",
        });
      }

      const ai = getGeminiClient();

      const prompt = `You are the AI Procurement & Eligibility Engine for Indian MSMEs.
Analyze the following public procurement tender text against the provided Indian MSME Profile.

=== MSME PROFILE ===
Company Name: ${msmeProfile.companyName || 'Bharat Precision Engineering Pvt Ltd'}
Udyam Registration: ${msmeProfile.udyamNumber || 'UDYAM-MH-01-0023456'}
GSTIN: ${msmeProfile.gstin || '27AABCB1234F1Z5'}
MSME Category: ${msmeProfile.category || 'Small'} Enterprise
Annual Turnover: ${msmeProfile.annualTurnover || '₹4.85 Crore'}
State: ${msmeProfile.state || 'Maharashtra'}
ZED Certified: ${msmeProfile.zedCertified ? 'YES (Gold Level)' : 'NO'}
Active Disputes: ${msmeProfile.activeDisputesCount || 0}
Document Vault Status: Valid Udyam Certificate, 3 Past Railway & Defence Completion Certificates (5 yrs track record), PAN Card, GST Returns, ISO 9001:2015.

=== TENDER DOCUMENT TEXT ===
${tenderText}

=== STATUTORY RULES TO APPLY ===
1. Public Procurement Policy for Micro and Small Enterprises (MSEs) Order, 2012:
   - 100% EMD (Earnest Money Deposit) exemption for registered MSEs with valid Udyam.
   - Tender document sets supplied free of cost.
   - 25% annual mandatory public procurement quota from MSEs.
   - L1 + 15% price band purchase preference.
2. GFR 2017 Rule 173(i) & Department of Expenditure OM No. F.20/2/2014-PPD(Pt.):
   - Mandatory relaxation of prior turnover and prior experience criteria for Startups and Micro/Small Enterprises, provided quality and technical specifications are satisfied.
3. Make in India (DPIIT Order 2017):
   - Preference for Class-I Local Suppliers (>= 50% local content).
4. Identify any missing document requirements such as Bank Solvency, CA net worth certificate, or specific lab tests, and classify urgency.
5. Provide a friendly, clear plain language summary in both English and Hindi.
6. Recommend 3 relevant government support schemes.

Generate the complete structured JSON response matching the provided schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are an expert Indian Government Procurement & MSME Compliance Auditor specializing in GeM, CPPP, GFR 2017, Public Procurement Policy for MSEs Order 2012, and Make in India rules. Always output valid JSON strictly matching the response schema.",
          responseMimeType: "application/json",
          responseSchema: tenderAnalysisResponseSchema,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini returned empty response text.");
      }

      const parsedData = JSON.parse(responseText.trim());
      
      // Augment or verify title/fileName if provided
      if (fileName && (!parsedData.title || parsedData.title.includes('Tender Document'))) {
        parsedData.title = fileName.replace('.pdf', '').replace(/_/g, ' ');
      }

      res.json(parsedData);
    } catch (error: any) {
      console.error("Error in /api/analyze-tender:", error);
      res.status(500).json({
        error: error.message || "Failed to analyze tender with Gemini AI.",
      });
    }
  });

  // Government Tender Integrity & Corrigendum Semantic Diff Endpoint
  app.post("/api/semantic-diff", async (req, res) => {
    try {
      const {
        originalText,
        amendedText,
        amendmentDate,
        tenderDeadline,
        daysGap,
        tenderRef,
        department,
        title,
      } = req.body;

      if (!originalText || !amendedText) {
        return res.status(400).json({
          error: "Missing required fields: 'originalText' and 'amendedText' are mandatory.",
        });
      }

      const ai = getGeminiClient();

      const prompt = `You are the Central Vigilance Commission (CVC) & GeM Tender Integrity & Semantic Diff Engine.
Perform a forensic vigilance audit comparing the Original Tender RFP text against the Amended Corrigendum text.

=== TIMELINE & STATUTORY METADATA ===
Tender Reference: ${tenderRef || 'GEM/2026/B/771923'}
Procuring Department: ${department || 'Ministry of Communications / BSNL'}
Tender Title: ${title || 'High-Capacity Fiber Optic Hardware & Transceivers'}
Corrigendum Publication Timestamp: ${amendmentDate || '2026-09-18T14:30'}
Bid Submission Cutoff Deadline: ${tenderDeadline || '2026-09-20T17:00'}
Days Elapsed Window: ${daysGap !== undefined ? daysGap : '2.1'} Days (${((daysGap || 2.1) * 24).toFixed(0)} Hours remaining before cutoff)

=== ORIGINAL TENDER RFP TEXT ===
${originalText}

=== AMENDED CORRIGENDUM TEXT ===
${amendedText}

=== VIGILANCE AUDIT DIRECTIVES ===
1. Statutory Cutoff Window Rule (GFR 2017 Rule 173(iii) & CVC Circular 01/04/2021):
   - Corrigenda issued less than 7 days before cutoff without extending the deadline are severe statutory breaches.
2. Restrictiveness & Collusion Analysis:
   - Identify clause modifications that increase restrictiveness (e.g. arbitrary net worth hikes, exclusionary turnover thresholds, eliminating Micro/Small enterprises).
   - Identify proprietary locks, restrictive local testing requirements (e.g. requiring tests only at single regional labs), or removed inspection safeguards.
3. Compute:
   - Overall corruption-risk score (0 to 100%) and riskLabel ('CRITICAL' if >=75%, 'MODERATE' if 40-74%, 'LOW' if <40%).
   - Detailed clause-by-clause diff items with originalText, changedText, semanticChangePercentage (0-100), timingBeforeDeadline, hoursBeforeDeadline, direction ('MORE RESTRICTIVE' | 'LESS RESTRICTIVE' | 'NEUTRAL'), riskScore, riskSeverity ('CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'), oneLineExplanation, and violationCode.
   - Comprehensive executive vigilance summary note for the Chief Procurement Vigilance Officer.

Generate the complete structured JSON response matching the provided schema.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are an expert Central Vigilance Commission (CVC) Forensic Auditor and Semantic Differential Engine for Indian public procurement. Always output valid JSON strictly matching the response schema.",
          responseMimeType: "application/json",
          responseSchema: semanticDiffResponseSchema,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini returned empty response text.");
      }

      const parsedData = JSON.parse(responseText.trim());
      res.json(parsedData);
    } catch (error: any) {
      console.error("Error in /api/semantic-diff:", error);
      res.status(500).json({
        error: error.message || "Failed to execute semantic diff with Gemini AI.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

# Complete Product Blueprint — Screen by Screen

## The Product: "Intelligent Procurement Integrity Platform"

This is a **single web application** with **two completely different dashboards** depending on who logs in:

```
┌─────────────────────────────────────────────────┐
│              LANDING PAGE (Public)               │
│                                                  │
│   ┌──────────────┐    ┌──────────────────────┐  │
│   │  MSME Login  │    │  Government Login     │  │
│   │  (Udyam+GST) │    │  (Officer ID + Dept)  │  │
│   └──────┬───────┘    └──────────┬───────────┘  │
│          │                       │               │
│          ▼                       ▼               │
│   ┌──────────────┐    ┌──────────────────────┐  │
│   │ MSME         │    │ GOVERNMENT           │  │
│   │ DASHBOARD    │    │ DASHBOARD            │  │
│   │ (6 screens)  │    │ (5 screens)          │  │
│   └──────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 🟢 MSME USER — What They See (6 Screens)

> **Who is this user?** A small business owner like Ramesh from Coimbatore who wants to sell to the government. He may not be tech-savvy. The UI must be simple, clean, and supportive.

### Screen 0: Login Page (`/login`)

```
┌──────────────────────────────────────────────┐
│                                              │
│          🏢 Procurement Integrity            │
│              Platform                        │
│                                              │
│   ┌─── I am a: ────────────────────────┐     │
│   │  ● MSME / Startup                  │     │
│   │  ○ Government Officer              │     │
│   └─────────────────────────────────────┘     │
│                                              │
│   Udyam Number:  [ UDYAM-TN-01-0012345 ]    │
│   GSTIN:         [ 33AABCU9603R1ZM      ]    │
│   Password:      [ ••••••••             ]    │
│                                              │
│           [ 🔐 Login Securely ]              │
│                                              │
│   Don't have an account? Register here       │
│                                              │
└──────────────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| **Powered by** | Frontend only (localStorage / JWT auth) |
| **What happens** | Validates Udyam format, loads MSME profile, redirects to MSME Dashboard |

---

### Screen 1: MSME Home Dashboard (`/msme/dashboard`)

> The first thing an MSME owner sees after login. A quick overview of everything.

```
┌──────────────────────────────────────────────────────────┐
│  🏢 Welcome, TechStart Pvt Ltd          [Profile] [Logout]│
│  Udyam: UDYAM-TN-01-0012345 | Turnover: ₹45L            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │ 📄 12    │  │ ✅ 7     │  │ ❌ 3     │  │ 💰 2     ││
│  │ Tenders  │  │ Eligible │  │ Not      │  │ Payments ││
│  │ Analyzed │  │          │  │ Eligible │  │ Overdue  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│                                                          │
│  📊 Recent Analysis Results                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Supply of Electrical Switches - Railways    ✅ 92%│   │
│  │ IT Equipment - Ministry of Defence          ❌ 34%│   │
│  │ Safety Gear - ONGC                          🟡 71%│   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  💡 Recommended Government Schemes                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🏷️ ZED Certification — 80% subsidy on ISO cost  │   │
│  │ 🏷️ CLCSS — 15% capital subsidy up to ₹15L       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘

SIDEBAR NAVIGATION:
  🏠 Dashboard        ← You are here
  🔍 Tender Marketplace
  📄 Analyze Tender
  📁 My Documents
  💰 Payment Tracker
  ⚙️ Profile & Settings
```

| Element | Detail |
|---|---|
| **Powered by** | Aggregated results from all previous analyses |
| **Key Feature** | At-a-glance overview: how many tenders analyzed, eligibility rate, overdue payments |

---

### Screen 2: Tender Marketplace (`/msme/marketplace`)

> Browse available government tenders filtered to match the MSME's product/service category.

```
┌──────────────────────────────────────────────────────────┐
│  🔍 Tender Marketplace                                   │
│                                                          │
│  Filter: [All Departments ▼] [EMD < ₹1L ▼] [This Week ▼]│
│  Search: [ Search tenders...                        🔍 ] │
│                                                          │
│  ┌────────────────────────────────┐ ┌─────────────────┐  │
│  │ 📄 Supply of Electrical       │ │ 📄 IT Equipment  │  │
│  │    Switches                   │ │    Procurement   │  │
│  │                               │ │                  │  │
│  │ 🏛️ Indian Railways           │ │ 🏛️ Min. of Defence│  │
│  │ 💰 EMD: ₹50,000              │ │ 💰 EMD: ₹2,00,000│  │
│  │ 📅 Deadline: 15 Sep 2026     │ │ 📅 Deadline: 20 Sep│  │
│  │ 📊 Turnover: ₹65L            │ │ 📊 Turnover: ₹5Cr │  │
│  │                               │ │                  │  │
│  │ 🟢 Likely Eligible            │ │ 🔴 Likely Not    │  │
│  │                               │ │                  │  │
│  │ [ 🔍 Analyze This Tender ]   │ │ [ 🔍 Analyze ]   │  │
│  └────────────────────────────────┘ └─────────────────┘  │
│                                                          │
│  ┌────────────────────────────────┐ ┌─────────────────┐  │
│  │ 📄 Safety Equipment           │ │ 📄 Office        │  │
│  │    for ONGC                   │ │    Furniture     │  │
│  │ ...                           │ │ ...              │  │
│  └────────────────────────────────┘ └─────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| **Powered by** | Mock data initially; later: GeM API / scraped tender data |
| **Key Feature** | Pre-filtered cards with a quick "Likely Eligible / Not" badge based on basic profile matching |

---

### Screen 3: Tender Analysis (THE CORE SCREEN) (`/msme/analyze`)

> This is the MAIN screen of your product. The MSME uploads a PDF and gets the full AI analysis.

```
┌──────────────────────────────────────────────────────────┐
│  📄 Tender Analysis                                      │
│                                                          │
│  ┌─────────────────────────┐ ┌────────────────────────┐  │
│  │                         │ │                        │  │
│  │  LEFT PANEL:            │ │  RIGHT PANEL:          │  │
│  │  UPLOAD & INPUT         │ │  AI RESULTS            │  │
│  │                         │ │                        │  │
│  │  ┌───────────────────┐  │ │  OVERALL VERDICT:      │  │
│  │  │                   │  │ │  ┌──────────────────┐  │  │
│  │  │   📂 Drag & Drop  │  │ │  │ 🎯 ELIGIBLE     │  │  │
│  │  │   Your Tender PDF │  │ │  │ Score: 87/100    │  │  │
│  │  │   here            │  │ │  │ (with MSME       │  │  │
│  │  │                   │  │ │  │  exemptions)     │  │  │
│  │  └───────────────────┘  │ │  └──────────────────┘  │  │
│  │                         │ │                        │  │
│  │  Or: [ Browse Files ]   │ │  RULE-BY-RULE:        │  │
│  │                         │ │                        │  │
│  │  ─────────────────────  │ │  ✅ EMD: ₹50,000      │  │
│  │                         │ │     EXEMPTED (MSME)    │  │
│  │  Your MSME Profile:     │ │     Confidence: 95%    │  │
│  │  ┌───────────────────┐  │ │     📖 Source: Pg 12   │  │
│  │  │ Name: TechStart   │  │ │                        │  │
│  │  │ Turnover: ₹45L    │  │ │  🟡 Turnover: ₹65L    │  │
│  │  │ Exp: 5 years      │  │ │     You: ₹45L (-30%)  │  │
│  │  │ MSME: ✅ Yes      │  │ │     EXEMPTED (MSME)    │  │
│  │  │ Certs: ISO 9001   │  │ │     Confidence: 88%    │  │
│  │  └───────────────────┘  │ │     📖 Source: Pg 47   │  │
│  │                         │ │                        │  │
│  │  [ 🚀 Analyze Now ]    │ │  ✅ Experience: 3 yr   │  │
│  │                         │ │     You: 5 yr (+67%)   │  │
│  │                         │ │     Confidence: 92%    │  │
│  │                         │ │                        │  │
│  │                         │ │  ❌ MISSING DOCUMENT:  │  │
│  │                         │ │     Solvency Cert      │  │
│  │                         │ │                        │  │
│  └─────────────────────────┘ └────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  📋 PLAIN LANGUAGE SUMMARY (Hindi Available 🇮🇳)  │    │
│  │                                                   │    │
│  │  "You are eligible for this tender! Your MSME     │    │
│  │   status exempts you from EMD and turnover rules. │    │
│  │   However, you are missing a Solvency Certificate │    │
│  │   — get one from your bank before 15 Sep 2026."   │    │
│  │                                                   │    │
│  │  [Switch to Hindi 🇮🇳]                             │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  💡 RECOMMENDED SCHEMES FOR YOU                   │    │
│  │                                                   │    │
│  │  🏷️ ZED Certification — Get ISO at 80% subsidy   │    │
│  │  🏷️ CLCSS — Capital subsidy up to ₹15 Lakh       │    │
│  │  🏷️ CGTMSE — Collateral-free loan up to ₹5 Cr    │    │
│  │                                                   │    │
│  │  [ View All Schemes → ]                           │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

| Element | Which Agent Powers It |
|---|---|
| PDF Upload + Text Extraction | **Agent 1.1** (PDF Extractor) |
| Rule-by-Rule Results | **Agent 1.3** (Neural Extractor) + **1.4** (Symbolic Verifier) |
| Confidence % + Source Page | **Agent 1.5** (Confidence Scorer) |
| Distance Percentages (-30%) | **Agent 1.6** (Compliance Distance) |
| Plain Language + Hindi | **Agent 1.7** (Tender Simplifier) |
| Missing Document Alert | **Agent 1.8** (Document Checker) |
| Recommended Schemes | **Agent 1.9** (Scheme Discovery) |

---

### Screen 4: My Documents (`/msme/documents`)

> A "document vault" where the MSME stores all their certificates so the system can auto-check readiness.

```
┌──────────────────────────────────────────────────────────┐
│  📁 My Documents (Document Vault)                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Document              Status       Expiry          │  │
│  │─────────────────────────────────────────────────── │  │
│  │ 📄 Udyam Certificate  ✅ Uploaded   No Expiry      │  │
│  │ 📄 GST Registration   ✅ Uploaded   No Expiry      │  │
│  │ 📄 PAN Card           ✅ Uploaded   No Expiry      │  │
│  │ 📄 ISO 9001           ✅ Uploaded   ⚠️ Exp: Dec 26 │  │
│  │ 📄 Last 3 Years ITR   ✅ Uploaded   —              │  │
│  │ 📄 Solvency Cert      ❌ Missing    —              │  │
│  │ 📄 Bank Statement     ❌ Missing    —              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Readiness Score: ████████░░ 71%                         │
│                                                          │
│  [ + Upload New Document ]                               │
│                                                          │
│  ⚠️ Your ISO 9001 certificate expires in 4 months!      │
│     Renew it using ZED Certification Scheme (80% off)    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| **Powered by** | **Agent 1.8** (Document Readiness Checker) |
| **Key Feature** | Proactive expiry warnings + readiness score |

---

### Screen 5: Payment Tracker (`/msme/payments`)

> Tracks whether the government is paying the MSME on time after winning a tender.

```
┌──────────────────────────────────────────────────────────┐
│  💰 Payment Tracker                                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Tender             Invoice    Due Date   Status    │  │
│  │──────────────────────────────────────────────────  │  │
│  │ Electrical Switches INV-0042  15 Aug 26  ✅ Paid   │  │
│  │ Safety Gear ONGC    INV-0051  01 Aug 26  🔴 67 days│  │
│  │                                          OVERDUE   │  │
│  │ IT Peripherals      INV-0063  10 Sep 26  🟡 Pending│  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  🔴 OVERDUE ALERT: Safety Gear ONGC                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Invoice Amount:     ₹3,50,000                      │  │
│  │ Days Overdue:       67 days                        │  │
│  │ Interest Owed:      ₹12,450 (Section 16 MSMED)    │  │
│  │ Interest Rate:      16.5% p.a. (3x RBI Bank Rate) │  │
│  │                                                    │  │
│  │ [ 📧 Send Demand Notice ]  [ 📋 Prepare ODR Filing]│  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Element | Detail |
|---|---|
| **Powered by** | **Agent 1.10** (Payment Delay Tracker) |
| **Key Feature** | Auto-computes Section 16 interest, drafts demand notices |

---

## 🔴 GOVERNMENT USER — What They See (5 Screens)

> **Who is this user?** A government procurement officer or vigilance officer who wants to ensure tenders are fair and detect corruption. Your teammates build most of this, but you build the Agent 5 screens.

### Screen 0: Government Login (`/login`)

Same login page, but user selects "Government Officer" and enters Officer ID + Department.

---

### Screen 1: Government Home Dashboard (`/govt/dashboard`)

```
┌──────────────────────────────────────────────────────────┐
│  🏛️ Government Procurement Integrity Dashboard           │
│  Officer: Ravi Kumar | Dept: Ministry of Railways        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │ 🚨 3     │  │ 📄 47    │  │ 🤖 12    │  │ ⚠️ 5     ││
│  │ Critical │  │ Active   │  │ Bids     │  │ Cartel   ││
│  │ Alerts   │  │ Tenders  │  │ Analyzed │  │ Suspects ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│                                                          │
│  🚨 CRITICAL ALERTS                                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🔴 Tender #9292805: Eligibility changed 2hrs    │   │
│  │    before deadline — CORRUPTION RISK: 87%        │   │
│  │    [ View Semantic Diff → ]                      │   │
│  │                                                   │   │
│  │ 🟡 Tender #8841023: 3 bidders with same IP      │   │
│  │    address — CARTEL RISK: 62%                    │   │
│  │    [ View Cartel Analysis → ]                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘

SIDEBAR NAVIGATION:
  🏠 Dashboard           ← You are here
  🔍 Tender Integrity    (YOUR Agent 5)
  🕵️ Cartel Detection    (Teammate's Agent 2)
  💳 Financial Verify    (Teammate's Agent 3)
  🛡️ Cyber Security      (Teammate's Agent 4)
```

---

### Screen 2: Tender Integrity Monitor — YOUR SCREEN (`/govt/integrity`)

> **This is YOUR Agent 5.** The officer uploads an original tender + its amendment (corrigendum) and the system detects if anyone secretly changed the rules.

```
┌──────────────────────────────────────────────────────────┐
│  🔍 Tender Integrity Monitor (Semantic Diff Engine)      │
│                                                          │
│  ┌─────────────────────┐  ┌─────────────────────────┐   │
│  │ 📄 ORIGINAL TENDER  │  │ 📄 CORRIGENDUM          │   │
│  │                     │  │    (Amendment)           │   │
│  │  [Drop PDF here]    │  │  [Drop PDF here]        │   │
│  │                     │  │                         │   │
│  └─────────────────────┘  └─────────────────────────┘   │
│                                                          │
│  Amendment Date: [ 28 Aug 2026 ]                         │
│  Tender Deadline: [ 30 Aug 2026 ]  (← 2 days gap! 🚨)   │
│                                                          │
│  [ 🔍 Run Semantic Diff ]                                │
│                                                          │
│  ═══════════════════════════════════════════════════      │
│  RESULTS:                                                │
│                                                          │
│  OVERALL CORRUPTION RISK: ████████████░░ 87% CRITICAL    │
│                                                          │
│  FLAGGED CHANGES:                                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔴 CLAUSE 4.2 — Eligibility (Risk: 2.28)         │  │
│  │                                                    │  │
│  │ ORIGINAL: "Open to Micro, Small, and Medium       │  │
│  │            enterprises"                            │  │
│  │ CHANGED:  "Open to Medium enterprises only"        │  │
│  │                                                    │  │
│  │ Semantic Change: 38% | Time: 48hrs before deadline │  │
│  │ Direction: MORE RESTRICTIVE (excluded Micro/Small) │  │
│  │                                                    │  │
│  │ ⚠️ This change excludes smaller MSMEs and was     │  │
│  │    made suspiciously close to the deadline.        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🟡 CLAUSE 7.1 — Payment Terms (Risk: 0.45)       │  │
│  │                                                    │  │
│  │ ORIGINAL: "Payment within 30 days of delivery"     │  │
│  │ CHANGED:  "Payment within 45 days of delivery"     │  │
│  │                                                    │  │
│  │ Semantic Change: 12% | Time: 15 days before       │  │
│  │ Direction: NEUTRAL                                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [ 📥 Download Report ]  [ 🚨 Escalate to Vigilance ]   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

| Element | Which Agent Powers It |
|---|---|
| PDF comparison | **Agent 5.1** (Clause Extractor) |
| Semantic similarity scores | **Agent 5.2** (Semantic Differ) |
| Corruption risk % + direction | **Agent 5.3** (Corruption Risk Scorer) |

---

### Screen 3: Cartel Detection (`/govt/cartel`) — Teammate's Screen

> Powered by teammate's Agent 2. Detects if multiple bidders are secretly working together.

```
┌──────────────────────────────────────────────────────────┐
│  🕵️ Cartel Detection (Bid Rigging Analysis)              │
│                                                          │
│  Network Graph: [Shows bidder connections]               │
│  Suspicious Patterns: Same IP, Same Bank, Price Rotation │
│                                                          │
│  (Built by Teammate — Agent 2)                           │
└──────────────────────────────────────────────────────────┘
```

### Screen 4: Financial Verification (`/govt/finance`) — Teammate's Screen

> Powered by teammate's Agent 3. Verifies if the bidder's financial claims are real.

### Screen 5: Cyber Security (`/govt/cyber`) — Teammate's Screen

> Powered by teammate's Agent 4. Detects bot behavior and fraud in bid submissions.

---

## Complete Module Map — Who Builds What

```
┌───────────────────────────────────────────────────────────────┐
│                    YOUR CONTRIBUTION                          │
│                                                               │
│  MSME SIDE (Frontend + Agent 1):                             │
│  ┌────────────┬────────────┬────────────┬──────────────┐     │
│  │ Login      │ Dashboard  │ Marketplace│ Tender       │     │
│  │ Screen     │ Home       │            │ Analysis     │     │
│  │            │            │            │ (CORE)       │     │
│  ├────────────┼────────────┼────────────┼──────────────┤     │
│  │ My         │ Payment    │            │              │     │
│  │ Documents  │ Tracker    │            │              │     │
│  └────────────┴────────────┴────────────┴──────────────┘     │
│                                                               │
│  GOVERNMENT SIDE (Agent 5 only):                             │
│  ┌─────────────────────────────────────────┐                 │
│  │ Tender Integrity Monitor                │                 │
│  │ (Semantic Diff + Corruption Scoring)    │                 │
│  └─────────────────────────────────────────┘                 │
│                                                               │
│  BACKEND:                                                    │
│  ┌─────────────────────────────────────────┐                 │
│  │ LangGraph Orchestrator                  │                 │
│  │ (Connects all 5 agents)                 │                 │
│  └─────────────────────────────────────────┘                 │
├───────────────────────────────────────────────────────────────┤
│                 TEAMMATES' CONTRIBUTION                       │
│                                                               │
│  ┌────────────┬────────────┬────────────┐                    │
│  │ Govt Login │ Govt Home  │ Cartel     │ ← Teammate builds │
│  │ + Auth     │ Dashboard  │ Detection  │   govt frontend    │
│  ├────────────┼────────────┼────────────┤                    │
│  │ Financial  │ Cyber      │ Bayesian   │                    │
│  │ Verify     │ Security   │ Fusion     │                    │
│  └────────────┴────────────┴────────────┘                    │
└───────────────────────────────────────────────────────────────┘
```

---

## Summary: Screen Count

### MSME User (YOUR screens to build):
| # | Screen | URL | Core Feature |
|---|---|---|---|
| 0 | Login | `/login` | Udyam + GSTIN authentication |
| 1 | Dashboard Home | `/msme/dashboard` | Overview cards + recent analyses |
| 2 | Tender Marketplace | `/msme/marketplace` | Browse + filter tender cards |
| 3 | **Tender Analysis** | `/msme/analyze` | **THE CORE — PDF upload + AI results** |
| 4 | My Documents | `/msme/documents` | Document vault + readiness score |
| 5 | Payment Tracker | `/msme/payments` | Overdue alerts + interest calculation |

### Government User (YOUR screen to build):
| # | Screen | URL | Core Feature |
|---|---|---|---|
| 1 | **Tender Integrity** | `/govt/integrity` | **Semantic diff + corruption scoring** |

**Total screens YOU build: 7** (6 MSME + 1 Government)

---

## For Generating UI Mockups with AI

When you go to an AI UI generator (like v0.dev, Figma AI, or Lovable), use these prompts:

**Prompt for Screen 3 (Tender Analysis — your CORE screen):**
> "Design a modern, dark-themed web dashboard for MSME tender analysis. Left panel: PDF upload dropzone with MSME profile summary card below it. Right panel: Overall eligibility verdict with a large circular score gauge, followed by a list of compliance rules — each rule shows a green/yellow/red traffic light, the rule name, required vs actual values, a compliance distance percentage, a confidence score, and a source page reference. Below the rules: a plain-language summary card with a Hindi toggle button. Below that: a recommended government schemes section with scheme cards. Use Inter font, glassmorphism cards, subtle gradients, and micro-animations."

**Prompt for Screen 2 (Tender Integrity — government screen):**
> "Design a modern government dashboard for tender corruption detection. Top section: two PDF upload zones side by side (Original Tender vs Amendment). Below: a large corruption risk gauge (0-100%). Below that: a list of flagged clause changes — each showing the original text vs changed text with red/yellow highlighting, semantic change percentage, time before deadline, and restriction direction badge. Use a professional dark blue theme with red alert accents."

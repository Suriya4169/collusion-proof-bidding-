# FULL APP: Team API & Architecture Blueprint

*This document is the master guide for your entire team (You, Suriya, Aakash, and Darani). It explains exactly why we chose our database architecture and lists the FastAPI endpoints each team member must build to wire the frontend.*

---

## 1. Architectural Rationale: "Why are we using these structures?"

If a professor asks *why* your team used this specific architecture, here is the exact engineering justification:

### A. Why FastAPI & Pydantic?
Because we are building an Agentic AI system, the AI (Gemini) will return raw JSON. If that JSON is malformed, the app crashes. **FastAPI combined with Pydantic** provides strict data validation. If Gemini hallucinates a string instead of an integer, Pydantic catches it immediately before it hits the database. Also, FastAPI automatically generates Swagger UI documentation, making frontend-backend wiring effortless.

### B. Why Polyglot Persistence (3 Different Databases)?
We cannot use one database because the 5 agents solve fundamentally different computer science problems:
1.  **PostgreSQL (Supabase):** Used for strict, relational, transactional data (User profiles, Financial numbers, Cyber logs). Provides ACID compliance.
2.  **ChromaDB (Vector Database):** Used by Agent 1 & Agent 5. A relational database cannot "search by meaning." ChromaDB stores tender PDFs as 768-dimensional mathematical vectors, allowing our RAG pipeline to find clauses based on semantic similarity.
3.  **Neo4j (Graph Database):** Used by Agent 2 (Suriya). Finding cartels requires traversing complex networks (Bidder → shares IP with → Bidder B). Graph databases traverse these relationships exponentially faster than SQL `JOIN` operations.

---

## 2. API Blueprint: Team Division

To make the Next.js UI work, the team must build a central FastAPI server with different "routers" for each member.

### A. Aakash's API (FinTech OCR - Agent 3)
*Aakash must build these endpoints to process bank statements and power the Financial Charts.*

*   `POST /api/finance/analyze-statement`
    *   **Input (FormData):** Bank Statement PDF, `bidder_id`
    *   **Action:** Runs OCR, extracts cash flow, calculates Current Ratio.
    *   **Output (JSON):** `{"current_ratio": 1.5, "solvency_status": "PASS", "cash_reserves": 500000}`
*   `GET /api/finance/bidder/{bidder_id}/charts`
    *   **Action:** Fetches historical financial data from PostgreSQL for Darani's Govt UI.

### B. Suriya's API (Cartel Graph - Agent 2)
*Suriya must build these endpoints to detect bid-rigging in Neo4j.*

*   `POST /api/cartel/analyze-bidders`
    *   **Input (JSON):** List of all bidders for a tender (IDs, IPs, Directors).
    *   **Action:** Ingests into Neo4j, runs clustering algorithms to find shared nodes.
    *   **Output (JSON):** `{"cartel_risk_score": 85.0, "flagged_bidders": ["B1", "B2"]}`
*   `GET /api/cartel/network-graph/{tender_id}`
    *   **Action:** Returns the raw Nodes and Edges JSON so Darani's frontend can draw the Cartel Web Visualizer.

### C. Darani's API (Cybersecurity & Govt UI - Agent 4)
*Darani must build the biometrics tracker and the endpoints that feed the Govt UI.*

*   `POST /api/cyber/log-biometrics`
    *   **Input (JSON):** Keystroke cadence arrays, mouse entropy scores from the MSME frontend.
    *   **Action:** Runs bot-detection models.
    *   **Output (JSON):** `{"is_bot": false, "confidence": 0.99}`
*   `GET /api/govt/dashboard/leaderboard/{tender_id}`
    *   **Action:** The master endpoint for the Govt Dashboard. Returns the ranked list of bidders with their final Bayesian Trust Scores.

### D. Your API & Master Orchestrator (Agent 1 & 5)
*(Detailed extensively in `my_portion_api_blueprint.md`)*

You must build the endpoints for the MSME UI, the Semantic Diff engine, and the Master LangGraph endpoint that calls Aakash, Suriya, and Darani's APIs to calculate the final score.

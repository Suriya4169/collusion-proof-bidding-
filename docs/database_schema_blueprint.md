# FULL APP: Master Data Structures & Database Schema

*This document outlines the data architecture for the ENTIRE 5-Agent Platform, including the work done by your teammates (Graph Cartel, FinTech, Cyber).*

---

## 1. Storage Strategy (The Polyglot Architecture)

To support all 5 agents, the platform uses three different types of databases:

1.  **Relational (PostgreSQL / Supabase):** Core profiles, analysis history, financial metrics, and cyber logs.
2.  **Vector (ChromaDB):** Mathematical embeddings of PDF paragraphs (used by Agent 1 & Agent 5).
3.  **Graph Database (Neo4j):** Nodes and relationships to detect bidder cartels (used by Agent 2 - Suriya).

---

## 2. Relational Schema (PostgreSQL) — The Central Hub

### Core Tables (Shared)
*   **`users`**: Base table for both MSMEs and Govt Officers. (Role: MSME, AUDITOR).
*   **`tenders`**: Metadata of all government tenders.

### Agent 1 Tables (Your Work - MSME Copilot)
*   **`msme_profiles`**: Udyam, GSTIN, Turnover, NIC code.
*   **`analysis_results`**: Agent 1.4 output (Pass/Fail, Distance Score).
*   **`user_documents`**: Document Vault (ISO, PAN, Expiry dates).
*   **`invoices`**: Payment tracking and Section 16 interest logs.

### Agent 3 Tables (Aakash - FinTech OCR)
*   **`financial_statements`**: 
    *   `bidder_id`
    *   `current_ratio` (Extracted by OCR)
    *   `cash_reserves`
    *   `solvency_status` (Pass/Fail based on tender rules)

### Agent 4 Tables (Darani - Cybersecurity)
*   **`biometric_logs`**:
    *   `session_id`
    *   `typing_cadence_score` (0 to 100)
    *   `mouse_movement_entropy`
    *   `is_bot_flag` (Boolean)

### Agent 5 Tables (Your Work - Legal Semantic Diff)
*   **`corrigendum_logs`**:
    *   `tender_id`
    *   `original_clause`
    *   `amended_clause`
    *   `semantic_change_pct`
    *   `corruption_risk_score`

---

## 3. Graph Database Schema (Neo4j) — Suriya's Work

*Used by Agent 2 (Graph Cartel) to power the Cartel Web Visualizer on the Govt Dashboard.*

### Nodes (Entities):
*   `(Bidder {id, name, turnover})`
*   `(IP_Address {address})`
*   `(Director {name, pan})`

### Edges (Relationships):
*   `(Bidder)-[:LOGGED_IN_FROM]->(IP_Address)`
*   `(Director)-[:DIRECTS]->(Bidder)`
*   *(If Bidder A and Bidder B both connect to the same IP_Address node, Agent 2 flags a Cartel Risk).*

---

## 4. Vector Database Schema (ChromaDB) — Your Work

*Used by Agent 1 (RAG Retriever) and Agent 5 (Semantic Diff).*

*   **Collection:** `tender_chunks`
    *   **Data:** 768-dimensional float array.
    *   **Metadata:** `{"tender_id": "GEM/123", "page": 12, "type": "original"}`
*   **Collection:** `corrigendum_chunks`
    *   **Metadata:** `{"tender_id": "GEM/123", "page": 3, "type": "amended"}`

---

## 5. The LangGraph Orchestrator (Backend Data Flow)

The LangGraph Orchestrator (which you build) takes data from ALL these databases to calculate the final **Bayesian Trust Score** shown on the Government Leaderboard.

**The Pydantic Aggregation Model:**
```python
class FinalBidderScore(BaseModel):
    bidder_id: str
    tender_id: str
    
    # From Agent 1 (You)
    eligibility_score: float      
    
    # From Agent 2 (Suriya)
    cartel_risk_score: float      
    
    # From Agent 3 (Aakash)
    financial_health_score: float 
    
    # From Agent 4 (Darani)
    bot_probability: float        
    
    # Master Score (Calculated by LangGraph using Bayesian Math)
    final_bayesian_trust_score: float 
```

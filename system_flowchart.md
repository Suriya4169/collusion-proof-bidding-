# Split User Experience Flowcharts (Mermaid.live Compatible)

Below are the separate Mermaid diagrams representing the two distinct user flows (Side A for MSMEs and Side B for Government Auditors). Copy and paste each code block individually into the [Mermaid Live Editor](https://mermaid.live/) to generate the diagrams.

---

## 1. Flow A: MSME Vendor Journey (Side A)

```mermaid
flowchart TD
    %% TIER 1: USER PORTAL SCREENS
    subgraph Portal [MSME USER PORTAL SCREENS]
        A([START]) --> B[Screen 1: Login / Register<br/>Enter Udyam / GSTIN]
        B --> C[Auto-fetch Company Profile<br/>Directors, Addresses]
        C --> D[Screen 2: Tender Marketplace<br/>Browse and select open tenders]
        D --> E[Screen 3: AI Copilot Upload<br/>Upload 100-page Tender PDF]
        F --> G[Screen 4: Doc Submission<br/>Upload bank statements & certificates]
        I -->|YES| J[Screen 5: Final Submission<br/>Enter bid declarations and sign]
        K --> L[Submission Success Page<br/>Bid submitted safely]
    end

    %% TIER 2: AI COPILOT ENGINES
    subgraph AI [AI COPILOT VERIFICATION ENGINES]
        E --> F[NLP Agent Rules Extract<br/>Identifies EMD, deadlines, turnovers]
        G --> H[FinTech solvency assessment<br/>Extracts solvency ratios & EMD liquidity]
        H --> I{Liquidity<br/>Sufficient?}
        I -->|NO| Warn[Warn MSME / Save Time<br/>High Risk Alert flagged]
        J --> K[Cybersecurity Agent<br/>Captures keystrokes, fingerprint, IP]
    end

    L --> M([END])
    Warn --> M

    %% Styles
    classDef terminal fill:#ffffff,stroke:#666666,stroke-width:2px;
    classDef client fill:#e0f2f1,stroke:#00695c,stroke-width:2px;
    classDef agent fill:#e0f7fa,stroke:#00838f,stroke-width:2px;
    classDef decision fill:#fff3e0,stroke:#ef6c00,stroke-width:2px;
    classDef process fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef fail fill:#ffe5e5,stroke:#c62828,stroke-width:2px,color:#c62828;

    class A,M terminal;
    class B,D,E,G,J,L client;
    class C,K process;
    class F,H agent;
    class I decision;
    class Warn fail;

    style Portal fill:#f4fbfb,stroke:#00695c,stroke-width:1px,stroke-dasharray: 5 5;
    style AI fill:#f2fafd,stroke:#00838f,stroke-width:1px,stroke-dasharray: 5 5;
```

---

## 2. Flow B: Government Auditor Journey (Side B)

```mermaid
flowchart TD
    %% TIER 1: GOVERNMENT PORTAL SCREENS
    subgraph Portal2 [GOVERNMENT AUDITOR PORTAL SCREENS]
        A2([START]) --> B2[Screen 1: Active Tenders<br/>Select closed tender e.g. 45 bids]
        B2 --> C2[Click 'Run AI Audit'<br/>Triggers orchestrator]
        C2 --> D2[Screen 2: Master Results<br/>Displays Bayesian Trust leaderboard]
        D2 --> E2[Screen 3: Deep-Dive Panel<br/>Select bidder to audit details]
        
        F2_1 --> G2[Screen 4: Award Decision<br/>Auditor reviews AI flags & audit trail]
        F2_2 --> G2
        F2_3 --> G2
        
        G2 --> H2[Click 'Award Contract'<br/>Contract awarded/blacklist vendor]
    end

    %% TIER 2: AI FORENSIC & CONSENSUS TIERS
    subgraph AI2 [AI FORENSIC & CONSENSUS TIERS]
        E2 --> F2_1[Tab 1: Financial Solvency<br/>Visual charts of cash flows & ratios]
        E2 --> F2_2[Tab 2: Cartel Graph<br/>IP & directorship link network map]
        E2 --> F2_3[Tab 3: Legal Risk<br/>Highlights late corrigendum amendments]
    end

    H2 --> I2([END])

    %% Styles
    classDef terminal fill:#ffffff,stroke:#666666,stroke-width:2px;
    classDef client fill:#e0f2f1,stroke:#00695c,stroke-width:2px;
    classDef gateway fill:#e8eaf6,stroke:#283593,stroke-width:2px;
    classDef agent fill:#e0f7fa,stroke:#00838f,stroke-width:2px;
    classDef process fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;

    class A2,I2 terminal;
    class B2,D2,E2,G2,H2 gateway;
    class C2 process;
    class F2_1,F2_2,F2_3 agent;

    style Portal2 fill:#f5f6fb,stroke:#283593,stroke-width:1px,stroke-dasharray: 5 5;
    style AI2 fill:#f2fafd,stroke:#00838f,stroke-width:1px,stroke-dasharray: 5 5;
```

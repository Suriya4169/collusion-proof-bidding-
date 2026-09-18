# AEGIS Cartel Graph

AEGIS is a FastAPI application for detecting suspicious relationships between procurement bidders. It builds an undirected bipartite graph connecting bidders to shared owners, IP addresses, bank routing codes, and declared assets, then calculates anomaly scores for connected bidder networks.

## Contents

- `main.py`: FastAPI API
- `graph.py`: NetworkX graph construction and graph-render payloads
- `scoring.py`: anomaly scoring and flagged-network detection
- `models.py`: request and response validation
- `index.html`, `app.js`, `styles.css`: dashboard frontend
- `data/`: demo bidder data and CSV templates
- `tests/`: scoring tests

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

Open `index.html` with a static server on port 8080, or use the VS Code Live Server extension. The dashboard expects the API at `http://localhost:8000`.

Run tests with:

```powershell
pytest
```

The included data is for demonstration only. Do not upload real personal IP addresses or procurement data without authorization.
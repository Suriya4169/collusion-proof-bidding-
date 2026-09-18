import json
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from graph import build_graph_render_payload
from models import BatchBidderRequest, BidderProfile, ComplianceSummary, GraphRenderPayload
from scoring import build_cartel_summary, compute_bidder_scores

DATA_FILE = Path(__file__).resolve().parent / "data" / "bidders.json"


def load_bidders() -> list[dict]:
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_bidders() -> None:
    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(ACTIVE_BIDDERS, file, indent=2)
        file.write("\n")


ACTIVE_BIDDERS = load_bidders()

app = FastAPI(title="Graph Cartel Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Graph Cartel Agent"}


@app.get("/analyze", response_model=ComplianceSummary)
def analyze_demo_bidders():
    summary = build_cartel_summary(ACTIVE_BIDDERS)
    return summary


@app.get("/bidders")
def get_bidders():
    return {"bidders": ACTIVE_BIDDERS, "count": len(ACTIVE_BIDDERS)}


@app.post("/bidders", response_model=BidderProfile)
def add_bidder(payload: BidderProfile):
    bidder = payload.model_dump()
    for index, existing in enumerate(ACTIVE_BIDDERS):
        if existing["bidder_id"] == bidder["bidder_id"]:
            ACTIVE_BIDDERS[index] = bidder
            save_bidders()
            return bidder
    ACTIVE_BIDDERS.append(bidder)
    save_bidders()
    return bidder


@app.post("/analyze", response_model=ComplianceSummary)
def analyze_bidders(payload: BatchBidderRequest):
    bidders = [bidder.model_dump() for bidder in payload.bidders]
    summary = build_cartel_summary(bidders)
    return summary


@app.get("/graph-render", response_model=GraphRenderPayload)
def graph_render_demo():
    anomaly_scores = compute_bidder_scores(ACTIVE_BIDDERS)
    render_payload = build_graph_render_payload(ACTIVE_BIDDERS, anomaly_scores)
    return render_payload


@app.post("/graph-render", response_model=GraphRenderPayload)
def graph_render(payload: BatchBidderRequest):
    bidders = [bidder.model_dump() for bidder in payload.bidders]
    anomaly_scores = compute_bidder_scores(bidders)
    render_payload = build_graph_render_payload(bidders, anomaly_scores)
    return render_payload


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)

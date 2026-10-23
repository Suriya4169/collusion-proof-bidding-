import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException

# Add cartel-graph to sys.path so we can cleanly import its modules
PROJECT_ROOT = Path(__file__).resolve().parents[4]
CARTEL_ROOT = PROJECT_ROOT / "cartel-graph"
if str(CARTEL_ROOT) not in sys.path:
    sys.path.insert(0, str(CARTEL_ROOT))

from models import (
    BidderProfile,
    BatchBidderRequest,
    ComplianceSummary,
    GraphRenderPayload,
)
from scoring import build_cartel_summary, compute_bidder_scores
from graph import build_graph_render_payload

router = APIRouter(
    prefix="/cartel",
    tags=["Agent 2C: Cartel & Collusion Graph Intelligence"]
)

DATA_FILE = CARTEL_ROOT / "data" / "bidders.json"

def _load_bidders() -> list[dict]:
    if DATA_FILE.exists():
        with DATA_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)
    return []

def _save_bidders(bidders: list[dict]) -> None:
    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(bidders, file, indent=2)
        file.write("\n")

@router.get("/health", summary="Cartel Graph Engine Health Status")
def health_check():
    return {
        "status": "ok",
        "service": "Agent 2C: Cartel & Collusion Graph Intelligence",
        "engine": "NetworkX Bipartite Graph Anomaly Detector"
    }

@router.get("/bidders", summary="Get all registered bidding entities")
def get_bidders():
    bidders = _load_bidders()
    return {"bidders": bidders, "count": len(bidders)}

@router.post("/bidders", response_model=BidderProfile, summary="Register or update a bidder profile")
def add_bidder(payload: BidderProfile):
    bidders = _load_bidders()
    bidder = payload.model_dump()
    for index, existing in enumerate(bidders):
        if existing["bidder_id"] == bidder["bidder_id"]:
            bidders[index] = bidder
            _save_bidders(bidders)
            return bidder
    bidders.append(bidder)
    _save_bidders(bidders)
    return bidder

@router.get("/analyze", response_model=ComplianceSummary, summary="Analyze active bidding pool for cartelization")
def analyze_demo_bidders():
    bidders = _load_bidders()
    if not bidders:
        raise HTTPException(status_code=400, detail="No active bidders available for cartel analysis.")
    return build_cartel_summary(bidders)

@router.post("/analyze", response_model=ComplianceSummary, summary="Analyze custom batch of bidders for collusion")
def analyze_bidders(payload: BatchBidderRequest):
    bidders = [bidder.model_dump() for bidder in payload.bidders]
    return build_cartel_summary(bidders)

@router.get("/graph-render", response_model=GraphRenderPayload, summary="Get visual bipartite graph nodes and links (Active pool)")
def graph_render_demo():
    bidders = _load_bidders()
    anomaly_scores = compute_bidder_scores(bidders)
    return build_graph_render_payload(bidders, anomaly_scores)

@router.post("/graph-render", response_model=GraphRenderPayload, summary="Get visual bipartite graph nodes and links (Custom batch)")
def graph_render(payload: BatchBidderRequest):
    bidders = [bidder.model_dump() for bidder in payload.bidders]
    anomaly_scores = compute_bidder_scores(bidders)
    return build_graph_render_payload(bidders, anomaly_scores)

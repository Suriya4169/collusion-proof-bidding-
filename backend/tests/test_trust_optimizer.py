"""
Tests for the Hardened Bayesian Trust Optimizer & Best Bidder Selection API.
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from src.api.routes.trust_optimizer import router

app = FastAPI()
app.include_router(router, prefix="/api")
client = TestClient(app)


def test_trust_optimizer_health():
    response = client.get("/api/trust-optimizer/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "Hardened Collusion-Resistant Trust Optimizer" in data["service"]


def test_trust_optimizer_get_leaderboard():
    response = client.get("/api/trust-optimizer/leaderboard/TENDER-2026-X12?num_bidders=10&seed=42")
    assert response.status_code == 200
    data = response.json()
    assert data["tender_id"] == "TENDER-2026-X12"
    assert "winner_id" in data
    assert data["total_evaluated"] == 10
    assert len(data["leaderboard"]) == 10

    # Ensure best bidder is ranked 1 and labeled as Winner
    winner_row = data["leaderboard"][0]
    assert winner_row["status"] == "Winner"
    assert winner_row["bidder_id"] == data["winner_id"]
    assert winner_row["composite_score"] is not None
    assert winner_row["fused_bayesian_trust_score"] > 0


def test_trust_optimizer_evaluate_post():
    payload = {
        "tender_id": "TENDER-TEST-99",
        "b_ref": 500000.0,
        "delta": 0.5,
        "num_bidders": 8,
        "seed": 123,
        "mu": 0.35,
        "min_registration_age": 2.0,
        "min_turnover": 100000.0,
    }
    response = client.post("/api/trust-optimizer/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["tender_id"] == "TENDER-TEST-99"
    assert len(data["leaderboard"]) == 8
    assert data["total_evaluated"] == 8
    assert data["winner_id"] is not None

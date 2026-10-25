import csv
import json
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

def get_client_ip(request: Request) -> str:
    """Extract real client IP address from proxy headers or connection host."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


from graph import build_graph_render_payload
from models import BatchBidderRequest, BidderProfile, ComplianceSummary, GraphRenderPayload
from scoring import build_cartel_summary, compute_bidder_scores

DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_FILE = DATA_DIR / "bidders.csv"
JSON_FILE = DATA_DIR / "bidders.json"


def load_bidders() -> list[dict]:
    if CSV_FILE.exists():
        grouped: dict[str, dict] = {}
        with CSV_FILE.open("r", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)
            for row in reader:
                bidder_id = (row.get("bidder_id") or "").strip()
                if not bidder_id:
                    continue
                name = (row.get("name") or bidder_id).strip()
                owner = (row.get("beneficial_owner") or "").strip()
                ip = (row.get("ip_address") or "").strip() or None
                bank = (row.get("bank_routing_code") or "").strip() or None
                asset = (row.get("declared_asset") or "").strip()

                if bidder_id not in grouped:
                    grouped[bidder_id] = {
                        "bidder_id": bidder_id,
                        "name": name,
                        "beneficial_owners": set(),
                        "submission_metadata": {
                            "ip_address": ip,
                            "bank_routing_code": bank,
                        },
                        "declared_assets": set()
                    }
                curr = grouped[bidder_id]
                if name: curr["name"] = name
                if ip and not curr["submission_metadata"]["ip_address"]:
                    curr["submission_metadata"]["ip_address"] = ip
                if bank and not curr["submission_metadata"]["bank_routing_code"]:
                    curr["submission_metadata"]["bank_routing_code"] = bank
                if owner:
                    for o in owner.replace(";", ",").replace("|", ",").split(","):
                        if o.strip(): curr["beneficial_owners"].add(o.strip())
                if asset:
                    for a in asset.replace(";", ",").replace("|", ",").split(","):
                        if a.strip(): curr["declared_assets"].add(a.strip())

        bidders = []
        for b_id, b in grouped.items():
            bidders.append({
                "bidder_id": b["bidder_id"],
                "name": b["name"],
                "beneficial_owners": [{"name": o} for o in sorted(b["beneficial_owners"])],
                "submission_metadata": b["submission_metadata"],
                "declared_assets": sorted(list(b["declared_assets"]))
            })
        if bidders:
            return bidders

    if JSON_FILE.exists():
        with JSON_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)
    return []


def save_bidders(bidders: list[dict]) -> None:
    CSV_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CSV_FILE.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["bidder_id", "name", "beneficial_owner", "ip_address", "bank_routing_code", "declared_asset"])
        for b in bidders:
            b_id = b["bidder_id"]
            name = b.get("name", b_id)
            owners = ", ".join(o["name"] for o in b.get("beneficial_owners", []))
            ip = b.get("submission_metadata", {}).get("ip_address", "") or ""
            bank = b.get("submission_metadata", {}).get("bank_routing_code", "") or ""
            assets = ", ".join(b.get("declared_assets", []))
            writer.writerow([b_id, name, owners, ip, bank, assets])

    # Also sync json
    with JSON_FILE.open("w", encoding="utf-8") as file:
        json.dump(bidders, file, indent=2)
        file.write("\n")


app = FastAPI(title="Graph Cartel Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    bidders = load_bidders()
    return {"status": "ok", "service": "Graph Cartel Agent", "bidders_count": len(bidders)}


@app.get("/client-ip")
def get_caller_ip(request: Request):
    ip = get_client_ip(request)
    return {"ip": ip, "is_loopback": ip in ("127.0.0.1", "::1", "localhost")}


@app.get("/analyze", response_model=ComplianceSummary)
def analyze_demo_bidders():
    bidders = load_bidders()
    summary = build_cartel_summary(bidders)
    return summary


@app.get("/bidders")
def get_bidders():
    bidders = load_bidders()
    return {"bidders": bidders, "count": len(bidders)}


@app.post("/bidders", response_model=BidderProfile)
def add_bidder(payload: BidderProfile, request: Request):
    bidders = load_bidders()
    bidder = payload.model_dump()
    meta = bidder.get("submission_metadata") or {}
    if not meta.get("ip_address"):
        meta["ip_address"] = get_client_ip(request)
        bidder["submission_metadata"] = meta
    for index, existing in enumerate(bidders):
        if existing["bidder_id"] == bidder["bidder_id"]:
            bidders[index] = bidder
            save_bidders(bidders)
            return bidder
    bidders.append(bidder)
    save_bidders(bidders)
    return bidder


@app.delete("/bidders/{bidder_id}")
def delete_bidder(bidder_id: str):
    bidders = load_bidders()
    original_len = len(bidders)
    bidders = [b for b in bidders if b.get("bidder_id") != bidder_id]
    if len(bidders) == original_len:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Bidder '{bidder_id}' not found.")
    save_bidders(bidders)
    return {"status": "success", "message": f"Bidder '{bidder_id}' removed from analysis pool.", "remaining_count": len(bidders)}


@app.post("/analyze", response_model=ComplianceSummary)
def analyze_bidders(payload: BatchBidderRequest):
    bidders = [bidder.model_dump() for bidder in payload.bidders]
    summary = build_cartel_summary(bidders)
    return summary


@app.get("/graph-render", response_model=GraphRenderPayload)
def graph_render_demo():
    bidders = load_bidders()
    anomaly_scores = compute_bidder_scores(bidders)
    render_payload = build_graph_render_payload(bidders, anomaly_scores)
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

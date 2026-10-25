import csv
import io
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Response, Request
from fastapi.responses import StreamingResponse

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
    BeneficialOwner,
    SubmissionMetadata,
)
from scoring import build_cartel_summary, compute_bidder_scores
from graph import build_graph_render_payload

router = APIRouter(
    prefix="/cartel",
    tags=["Agent 2C: Cartel & Collusion Graph Intelligence"]
)

CSV_FILE = CARTEL_ROOT / "data" / "bidders.csv"
DATA_FILE = CARTEL_ROOT / "data" / "bidders.json"
BENCHMARK_FILE = CARTEL_ROOT / "data" / "bidders_benchmark.json"

def _load_bidders(tender_id: Optional[str] = None) -> list[dict]:
    bidders = []
    if CSV_FILE.exists():
        grouped: dict[str, dict] = {}
        try:
            with CSV_FILE.open("r", encoding="utf-8-sig") as file:
                reader = csv.DictReader(file)
                for row in reader:
                    bidder_id = (row.get("bidder_id") or "").strip()
                    if not bidder_id:
                        continue
                    t_id = (row.get("tender_id") or "GEM/2026/B/9292805").strip()
                    name = (row.get("name") or bidder_id).strip()
                    owner = (row.get("beneficial_owner") or "").strip()
                    ip = (row.get("ip_address") or "").strip() or None
                    bank = (row.get("bank_routing_code") or "").strip() or None
                    asset = (row.get("declared_asset") or "").strip()

                    if bidder_id not in grouped:
                        grouped[bidder_id] = {
                            "bidder_id": bidder_id,
                            "name": name,
                            "tender_id": t_id,
                            "beneficial_owners": set(),
                            "submission_metadata": {
                                "ip_address": ip,
                                "bank_routing_code": bank,
                            },
                            "declared_assets": set()
                        }
                    curr = grouped[bidder_id]
                    if name: curr["name"] = name
                    if t_id: curr["tender_id"] = t_id
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

            for b_id, b in grouped.items():
                bidders.append({
                    "bidder_id": b["bidder_id"],
                    "name": b["name"],
                    "tender_id": b.get("tender_id", "GEM/2026/B/9292805"),
                    "beneficial_owners": [{"name": o} for o in sorted(b["beneficial_owners"])],
                    "submission_metadata": b["submission_metadata"],
                    "declared_assets": sorted(list(b["declared_assets"]))
                })
        except Exception:
            pass

    if not bidders and DATA_FILE.exists():
        try:
            with DATA_FILE.open("r", encoding="utf-8") as file:
                raw = json.load(file)
                for b in raw:
                    if "tender_id" not in b:
                        b["tender_id"] = "GEM/2026/B/9292805"
                bidders = raw
        except Exception:
            bidders = []

    # If tender_id is provided and not "ALL", filter bidders participating in this tender
    if tender_id and tender_id.strip() and tender_id.upper() != "ALL":
        target = tender_id.strip()
        filtered = [b for b in bidders if b.get("tender_id") == target]
        return filtered

    return bidders


def _save_bidders(bidders: list[dict]) -> None:
    CSV_FILE.parent.mkdir(parents=True, exist_ok=True)
    with CSV_FILE.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["tender_id", "bidder_id", "name", "beneficial_owner", "ip_address", "bank_routing_code", "declared_asset"])
        for b in bidders:
            t_id = b.get("tender_id") or "GEM/2026/B/9292805"
            b_id = b["bidder_id"]
            name = b.get("name", b_id)
            owners = ", ".join(o["name"] for o in b.get("beneficial_owners", []))
            ip = b.get("submission_metadata", {}).get("ip_address", "") or ""
            bank = b.get("submission_metadata", {}).get("bank_routing_code", "") or ""
            assets = ", ".join(b.get("declared_assets", []))
            writer.writerow([t_id, b_id, name, owners, ip, bank, assets])

    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(bidders, file, indent=2)
        file.write("\n")


@router.get("/health", summary="Cartel Graph Engine Health Status")
def health_check():
    return {
        "status": "ok",
        "service": "Agent 2C: Cartel & Collusion Graph Intelligence",
        "engine": "NetworkX Bipartite Graph Anomaly Detector",
        "active_bidders": len(_load_bidders())
    }


@router.get("/tenders", summary="Get list of tenders with active bidding networks")
def get_cartel_tenders():
    bidders = _load_bidders()
    tenders_set = set()
    for b in bidders:
        t_id = b.get("tender_id")
        if t_id:
            tenders_set.add(t_id)
    # Ensure default tenders are listed
    tenders_set.add("GEM/2026/B/9292805")
    tenders_set.add("T2001")
    tenders_set.add("T2003")
    return {
        "tenders": sorted(list(tenders_set)),
        "count": len(tenders_set)
    }


@router.get("/client-ip", summary="Get true detected client IP address")
def get_caller_ip(request: Request):
    ip = get_client_ip(request)
    return {
        "ip": ip,
        "is_loopback": ip in ("127.0.0.1", "::1", "localhost"),
        "origin": "network_telemetry"
    }


@router.get("/bidders", summary="Get all registered bidding entities")
def get_bidders(tender_id: Optional[str] = Query(None, description="Optional tender ID to filter bidders competing for a specific tender")):
    bidders = _load_bidders(tender_id=tender_id)
    return {"bidders": bidders, "count": len(bidders), "tender_id": tender_id or "ALL"}


@router.post("/bidders", response_model=BidderProfile, summary="Register or update a bidder profile")
def add_bidder(payload: BidderProfile, request: Request):
    bidders = _load_bidders()
    bidder = payload.model_dump()
    if not bidder.get("tender_id"):
        bidder["tender_id"] = "GEM/2026/B/9292805"
    # If client didn't supply an IP or it is empty, automatically bind the real client IP:
    meta = bidder.get("submission_metadata") or {}
    if not meta.get("ip_address"):
        meta["ip_address"] = get_client_ip(request)
        bidder["submission_metadata"] = meta
    for index, existing in enumerate(bidders):
        if existing["bidder_id"] == bidder["bidder_id"]:
            bidders[index] = bidder
            _save_bidders(bidders)
            return bidder
    bidders.append(bidder)
    _save_bidders(bidders)
    return bidder

@router.delete("/bidders/{bidder_id}", summary="Delete a bidder from the active pool")
def delete_bidder(bidder_id: str):
    bidders = _load_bidders()
    original_len = len(bidders)
    bidders = [b for b in bidders if b.get("bidder_id") != bidder_id]
    if len(bidders) == original_len:
        raise HTTPException(status_code=404, detail=f"Bidder '{bidder_id}' not found in active pool.")
    _save_bidders(bidders)
    return {
        "status": "success",
        "message": f"Bidder '{bidder_id}' removed from cartel pool.",
        "remaining_count": len(bidders)
    }

@router.post("/reset", summary="Reset bidders to benchmark dataset or clear")
def reset_bidders(mode: str = Query("benchmark", description="'benchmark' or 'clear'")):
    if mode == "clear":
        _save_bidders([])
        return {"status": "success", "message": "All bidders cleared.", "count": 0}
    
    if BENCHMARK_FILE.exists():
        with BENCHMARK_FILE.open("r", encoding="utf-8") as f:
            bench = json.load(f)
        _save_bidders(bench)
        return {"status": "success", "message": "Reset to benchmark dataset (9 bidders).", "count": len(bench)}
    
    return {"status": "error", "message": "Benchmark file not found."}

@router.get("/sample-csv", summary="Download sample CSV template for testing collusion")
def get_sample_csv():
    sample_content = (
        "bidder_id,name,beneficial_owner,ip_address,bank_routing_code,declared_asset\n"
        "B001,Alpha Construction Ltd,Jane Doe,203.0.113.5,021000021,ASSET-1001\n"
        "B001,Alpha Construction Ltd,Robert Chen,203.0.113.5,021000021,ASSET-2001\n"
        "B002,Beta Infra Works,Jane Doe,203.0.113.5,011401533,ASSET-1001\n"
        "B002,Beta Infra Works,Paul Green,203.0.113.5,011401533,ASSET-7777\n"
        "B003,Gamma Civil Co,John Silva,203.0.113.5,071000013,ASSET-3001\n"
        "B004,Delta Buildcon,Sarah Connor,198.51.100.22,021000021,ASSET-5555\n"
        "B005,Epsilon Tech Corp,Michael Scott,192.0.2.88,091000019,ASSET-9999\n"
    )
    return Response(
        content=sample_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bidders_sample.csv"}
    )

@router.post("/upload-csv", summary="Upload custom bidders CSV to dynamically analyze collusion")
async def upload_bidders_csv(file: UploadFile = File(...), replace: bool = Query(True, description="Replace entire pool or append")):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file appears empty or malformed.")

    # Normalize headers
    field_map = {}
    for f in reader.fieldnames:
        cleaned = f.strip().lower().replace(" ", "_")
        field_map[cleaned] = f

    # Find field matches
    def get_val(row: dict, candidates: list[str]) -> Optional[str]:
        for c in candidates:
            if c in field_map:
                val = row.get(field_map[c], "")
                if val is not None and str(val).strip():
                    return str(val).strip()
        return None

    grouped_bidders: Dict[str, dict] = {}
    
    for row in reader:
        bidder_id = get_val(row, ["bidder_id", "id", "vendor_id", "company_id"])
        if not bidder_id:
            continue
        
        name = get_val(row, ["name", "bidder_name", "company_name", "vendor_name"]) or bidder_id
        owner_raw = get_val(row, ["beneficial_owner", "beneficial_owners", "director", "owner", "directors", "promoter"])
        ip = get_val(row, ["ip_address", "ip", "submission_ip", "network_ip"])
        bank = get_val(row, ["bank_routing_code", "bank_code", "ifsc", "routing_code", "bank_ifsc"])
        asset_raw = get_val(row, ["declared_asset", "declared_assets", "asset", "assets", "equipment_id", "machinery_id"])

        if bidder_id not in grouped_bidders:
            grouped_bidders[bidder_id] = {
                "bidder_id": bidder_id,
                "name": name,
                "beneficial_owners": set(),
                "ip_address": ip,
                "bank_routing_code": bank,
                "declared_assets": set()
            }
        
        curr = grouped_bidders[bidder_id]
        if name and curr["name"] == bidder_id:
            curr["name"] = name
        if ip and not curr["ip_address"]:
            curr["ip_address"] = ip
        if bank and not curr["bank_routing_code"]:
            curr["bank_routing_code"] = bank
        
        if owner_raw:
            for piece in owner_raw.replace(";", ",").replace("|", ",").split(","):
                p = piece.strip()
                if p:
                    curr["beneficial_owners"].add(p)

        if asset_raw:
            for piece in asset_raw.replace(";", ",").replace("|", ",").split(","):
                p = piece.strip()
                if p:
                    curr["declared_assets"].add(p)

    if not grouped_bidders:
        raise HTTPException(status_code=400, detail="No valid bidder records found in CSV. Please verify column headers.")

    parsed_profiles = []
    for b_id, b_data in grouped_bidders.items():
        parsed_profiles.append({
            "bidder_id": b_id,
            "name": b_data["name"],
            "beneficial_owners": [{"name": o} for o in sorted(b_data["beneficial_owners"])],
            "submission_metadata": {
                "ip_address": b_data["ip_address"],
                "bank_routing_code": b_data["bank_routing_code"]
            },
            "declared_assets": sorted(list(b_data["declared_assets"]))
        })

    if replace:
        final_bidders = parsed_profiles
    else:
        existing = _load_bidders()
        existing_map = {b["bidder_id"]: b for b in existing}
        for p in parsed_profiles:
            existing_map[p["bidder_id"]] = p
        final_bidders = list(existing_map.values())

    _save_bidders(final_bidders)

    # Compute immediate summary
    summary = build_cartel_summary(final_bidders)
    scores = compute_bidder_scores(final_bidders)

    return {
        "status": "success",
        "message": f"Successfully parsed and loaded {len(parsed_profiles)} bidders from CSV.",
        "total_active_bidders": len(final_bidders),
        "cartel_detected": summary.cartel_detected,
        "flagged_networks": len(summary.flagged_networks),
        "bidders": final_bidders
    }

@router.get("/analyze", response_model=ComplianceSummary, summary="Analyze active bidding pool for cartelization (per tender or all)")
def analyze_demo_bidders(tender_id: Optional[str] = Query(None, description="Optional tender ID to evaluate collusion specific to that tender")):
    bidders = _load_bidders(tender_id=tender_id)
    if not bidders:
        return ComplianceSummary(cartel_detected=False, flagged_networks=[], anomaly_scores={})
    return build_cartel_summary(bidders)

@router.post("/analyze", response_model=ComplianceSummary, summary="Analyze custom batch of bidders for collusion")
def analyze_bidders(payload: BatchBidderRequest):
    bidders = [bidder.model_dump() for bidder in payload.bidders]
    return build_cartel_summary(bidders)

@router.get("/graph-render", response_model=GraphRenderPayload, summary="Get visual bipartite graph nodes and links (per tender or all)")
def graph_render_demo(tender_id: Optional[str] = Query(None, description="Optional tender ID to render bipartite network specific to that tender")):
    bidders = _load_bidders(tender_id=tender_id)
    if not bidders:
        return GraphRenderPayload(bidders=[], metadata=[], bipartite=[], anomalyScores={})
    anomaly_scores = compute_bidder_scores(bidders)
    return build_graph_render_payload(bidders, anomaly_scores)

@router.post("/graph-render", response_model=GraphRenderPayload, summary="Get visual bipartite graph nodes and links (Custom batch)")
def graph_render(payload: BatchBidderRequest):
    bidders = [bidder.model_dump() for bidder in payload.bidders]
    if not bidders:
        return GraphRenderPayload(bidders=[], metadata=[], bipartite=[], anomalyScores={})
    anomaly_scores = compute_bidder_scores(bidders)
    return build_graph_render_payload(bidders, anomaly_scores)


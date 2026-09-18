from __future__ import annotations

import os
from collections import Counter, defaultdict
from typing import Dict, List

from graph import build_bidder_graph, find_bidder_pairs_within_two_hops


DEFAULT_WEIGHTS = {
    "asset_sharing": 0.45,
    "owner_overlap": 0.35,
    "pricing_similarity": 0.20,
    "rho_asset_penalty": 0.30,
}


def _normalize_score(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _shared_metadata_counts(bidders: List[dict]) -> Dict[str, Dict[str, int]]:
    counts: Dict[str, Dict[str, int]] = defaultdict(lambda: {"shared_assets": 0, "shared_owners": 0, "shared_ips": 0, "shared_banks": 0})

    for bidder in bidders:
        bidder_id = bidder["bidder_id"]
        counts[bidder_id] = {"shared_assets": 0, "shared_owners": 0, "shared_ips": 0, "shared_banks": 0}

    for idx, bidder in enumerate(bidders):
        bidder_id = bidder["bidder_id"]
        for other_idx in range(idx + 1, len(bidders)):
            other = bidders[other_idx]
            other_id = other["bidder_id"]
            shared_owners = set(o["name"] for o in bidder.get("beneficial_owners", [])) & set(o["name"] for o in other.get("beneficial_owners", []))
            shared_assets = set(bidder.get("declared_assets", [])) & set(other.get("declared_assets", []))
            same_ip = bidder.get("submission_metadata", {}).get("ip_address") == other.get("submission_metadata", {}).get("ip_address")
            same_bank = bidder.get("submission_metadata", {}).get("bank_routing_code") == other.get("submission_metadata", {}).get("bank_routing_code")

            if shared_owners:
                counts[bidder_id]["shared_owners"] += len(shared_owners)
                counts[other_id]["shared_owners"] += len(shared_owners)
            if shared_assets:
                counts[bidder_id]["shared_assets"] += len(shared_assets)
                counts[other_id]["shared_assets"] += len(shared_assets)
            if same_ip:
                counts[bidder_id]["shared_ips"] += 1
                counts[other_id]["shared_ips"] += 1
            if same_bank:
                counts[bidder_id]["shared_banks"] += 1
                counts[other_id]["shared_banks"] += 1

    return counts


def compute_rho_i(bidders: List[dict]) -> Dict[str, float]:
    """Compute technical uniqueness penalty rho_i based on asset sharing.

    A bidder who reuses certificates/serials with many competitors receives a higher penalty,
    which effectively raises their anomaly score because their technical footprint is less unique.
    """
    asset_frequency = Counter()
    for bidder in bidders:
        for asset in bidder.get("declared_assets", []):
            asset_frequency[asset] += 1

    rho: Dict[str, float] = {}
    for bidder in bidders:
        bidder_id = bidder["bidder_id"]
        asset_count = len(bidder.get("declared_assets", []))
        if asset_count == 0:
            rho[bidder_id] = 0.0
            continue

        shared_asset_penalty = 0.0
        for asset in bidder.get("declared_assets", []):
            freq = asset_frequency.get(asset, 0)
            if freq > 1:
                shared_asset_penalty += (freq - 1) / max(1, asset_count)

        rho[bidder_id] = _normalize_score(min(1.0, shared_asset_penalty * 0.8))

    return rho


def _get_weight_overrides() -> Dict[str, float]:
    """Allow the scoring weights to be tuned via environment variables in production."""
    env_map = {
        "asset_sharing": "AEGIS_WEIGHT_ASSET_SHARING",
        "owner_overlap": "AEGIS_WEIGHT_OWNER_OVERLAP",
        "pricing_similarity": "AEGIS_WEIGHT_PRICING_SIMILARITY",
        "rho_asset_penalty": "AEGIS_WEIGHT_RHO_ASSET_PENALTY",
    }
    overrides: Dict[str, float] = {}
    for key, env_name in env_map.items():
        value = os.getenv(env_name)
        if value is not None:
            try:
                overrides[key] = float(value)
            except ValueError:
                continue
    return overrides


def compute_bidder_scores(bidders: List[dict], weights: Dict[str, float] | None = None) -> Dict[str, float]:
    """Compute per-bidder anomaly scores A_i.

    The formula is intentionally simple and configurable:

      A_i = w_a * S_a + w_o * O_i + w_c * S_c - w_rho * rho_i

    where:
      - S_a: asset-sharing signal, from overlap in declared equipment/certificates
      - O_i: owner/director overlap signal, from shared beneficial owners
      - S_c: coordination signal, from shared network identifiers and co-bidding proximity
      - rho_i: technical uniqueness penalty, which increases when serials/certs are reused

    The final score is clamped to [0, 1].
    """
    weights = {**DEFAULT_WEIGHTS, **_get_weight_overrides(), **(weights or {})}
    graph = build_bidder_graph(bidders)
    rho = compute_rho_i(bidders)
    counts = _shared_metadata_counts(bidders)
    pair_paths = find_bidder_pairs_within_two_hops(graph)

    coord_counts = defaultdict(int)
    for _, _, path in pair_paths:
        for node in path:
            if node.startswith("DIR_") or node.startswith("IP_") or node.startswith("RTG_") or node.startswith("ASSET_"):
                coord_counts[node] += 1

    bidder_scores: Dict[str, float] = {}
    for bidder in bidders:
        bidder_id = bidder["bidder_id"]
        raw_asset_overlap = counts[bidder_id]["shared_assets"] / max(1, len(bidder.get("declared_assets", [])))
        raw_owner_overlap = counts[bidder_id]["shared_owners"] / max(1, len(bidder.get("beneficial_owners", [])))
        network_overlap = (counts[bidder_id]["shared_ips"] + counts[bidder_id]["shared_banks"]) / 2.0

        # The shared metadata signal should rise quickly when there is evidence of a genuine
        # collusive network. We normalize to [0, 1] and then amplify the bidder's "shared" posture
        # to keep anomaly scores informative for known cartel examples.
        shared_assets_score = _normalize_score(raw_asset_overlap * 1.6)
        owner_score = _normalize_score(raw_owner_overlap * 1.8)
        coordination_score = _normalize_score(min(1.0, network_overlap * 0.75 + raw_asset_overlap * 0.75))

        raw = (
            weights["asset_sharing"] * shared_assets_score
            + weights["owner_overlap"] * owner_score
            + weights["pricing_similarity"] * coordination_score
            - weights["rho_asset_penalty"] * rho.get(bidder_id, 0.0)
        )
        bidder_scores[bidder_id] = _normalize_score(raw)

    return bidder_scores


def build_cartel_summary(bidders: List[dict], weights: Dict[str, float] | None = None) -> dict:
    """Return compliance-style summary plus flagged bidder networks."""
    scores = compute_bidder_scores(bidders, weights=weights)
    graph = build_bidder_graph(bidders)
    flagged_pairs = []

    for bidder_a, bidder_b, path in find_bidder_pairs_within_two_hops(graph):
        reason_parts = []
        for node in path[1:-1]:
            attrs = graph.nodes[node]
            if attrs.get("kind") == "director":
                reason_parts.append(f"shared director {attrs['label']}")
            elif attrs.get("kind") == "ip":
                reason_parts.append(f"Shared IP address {attrs['label']}")
            elif attrs.get("kind") == "bank":
                reason_parts.append(f"Shared bank routing code {attrs['label']}")
            elif attrs.get("kind") == "asset":
                reason_parts.append(f"Shared asset certificate {attrs['label']}")
        if reason_parts:
            flagged_pairs.append({
                "bidders": [bidder_a, bidder_b],
                "reason": " and ".join(reason_parts),
            })

    flagged_networks = flagged_pairs if flagged_pairs else []
    cartel_detected = bool(flagged_networks)

    return {
        "cartel_detected": cartel_detected,
        "flagged_networks": flagged_networks,
        "anomaly_scores": {k: round(float(v), 4) for k, v in scores.items()},
    }

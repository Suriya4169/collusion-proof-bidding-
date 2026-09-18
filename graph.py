from __future__ import annotations

from typing import Dict, List, Tuple

import networkx as nx


def build_bidder_graph(bidders: List[dict]) -> nx.Graph:
    """Build a bipartite graph with bidders on one side and shared metadata on the other."""
    graph = nx.Graph()

    for bidder in bidders:
        bidder_id = bidder["bidder_id"]
        graph.add_node(bidder_id, kind="bidder", name=bidder["name"])

        for owner in bidder.get("beneficial_owners", []) or []:
            owner_name = str(owner["name"]).strip()
            if not owner_name:
                continue
            meta_id = f"DIR_{owner_name}"
            graph.add_node(meta_id, kind="director", label=owner_name, detail="Beneficial owner / director")
            graph.add_edge(bidder_id, meta_id)

        meta = bidder.get("submission_metadata") or {}
        ip = str(meta.get("ip_address") or "").strip()
        if ip:
            meta_id = f"IP_{ip}"
            graph.add_node(meta_id, kind="ip", label=ip, detail="Submission network fingerprint")
            graph.add_edge(bidder_id, meta_id)

        bank = str(meta.get("bank_routing_code") or "").strip()
        if bank:
            meta_id = f"RTG_{bank}"
            graph.add_node(meta_id, kind="bank", label=bank, detail="Settlement routing code")
            graph.add_edge(bidder_id, meta_id)

        for asset in bidder.get("declared_assets", []) or []:
            asset_name = str(asset).strip()
            if not asset_name:
                continue
            meta_id = f"ASSET_{asset_name}"
            graph.add_node(meta_id, kind="asset", label=asset_name, detail="Declared equipment / certificate")
            graph.add_edge(bidder_id, meta_id)

    return graph


def find_bidder_pairs_within_two_hops(graph: nx.Graph) -> List[Tuple[str, str, List[str]]]:
    """Return bidder pairs connected by a shared metadata node within two hops.

    In this bipartite graph, bidders only connect to metadata nodes. A path of length 2 is
    therefore equivalent to two bidders sharing at least one metadata node (e.g., same IP,
    director, bank route, or asset). We use the graph's neighbors directly rather than relying
    on NetworkX's has_path(cutoff=...) API, which is not available in the current stable version.
    """
    bidders = {n for n, attrs in graph.nodes(data=True) if attrs.get("kind") == "bidder"}
    results: List[Tuple[str, str, List[str]]] = []

    for bidder_a in sorted(bidders):
        for bidder_b in sorted(bidders):
            if bidder_a >= bidder_b:
                continue

            shared_meta = set(graph.neighbors(bidder_a)) & set(graph.neighbors(bidder_b))
            if not shared_meta:
                continue

            path = [bidder_a, next(iter(shared_meta)), bidder_b]
            results.append((bidder_a, bidder_b, path))

    return results


def build_graph_render_payload(bidders: List[dict], anomaly_scores: Dict[str, float]) -> dict:
    """Return the exact payload shape used by the existing frontend."""
    graph = build_bidder_graph(bidders)
    metadata = []
    bipartite = []

    node_meta_by_id: Dict[str, dict] = {}
    for node_id, attrs in graph.nodes(data=True):
        if attrs.get("kind") == "bidder":
            continue
        metadata.append({
            "id": node_id,
            "kind": attrs.get("kind", "unknown"),
            "label": attrs.get("label", node_id),
            "detail": attrs.get("detail", "Shared metadata"),
        })
        node_meta_by_id[node_id] = attrs

    for bidder in bidders:
        bidder_id = bidder["bidder_id"]
        for neighbor in graph.neighbors(bidder_id):
            if graph.nodes[neighbor].get("kind") != "bidder":
                bipartite.append([bidder_id, neighbor])

    normalized_bidders = [{"id": bidder["bidder_id"], "name": bidder["name"]} for bidder in bidders]
    return {
        "bidders": normalized_bidders,
        "metadata": metadata,
        "bipartite": bipartite,
        "anomalyScores": {bidder["bidder_id"]: float(anomaly_scores.get(bidder["bidder_id"], 0.0)) for bidder in bidders},
    }

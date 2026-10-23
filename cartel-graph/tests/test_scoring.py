from scoring import compute_bidder_scores, build_cartel_summary


def test_known_cartel_scores_higher_than_clean_bidder():
    bidders = [
        {
            "bidder_id": "B001",
            "name": "Alpha Construction Ltd",
            "beneficial_owners": [{"name": "Jane Doe"}, {"name": "Robert Chen"}],
            "submission_metadata": {
                "ip_address": "203.0.113.5",
                "bank_routing_code": "021000021",
            },
            "declared_assets": ["ASSET-1001", "ASSET-2001"],
        },
        {
            "bidder_id": "B002",
            "name": "Beta Infra Works",
            "beneficial_owners": [{"name": "Jane Doe"}, {"name": "Paul Green"}],
            "submission_metadata": {
                "ip_address": "203.0.113.5",
                "bank_routing_code": "011401533",
            },
            "declared_assets": ["ASSET-1001", "ASSET-7777"],
        },
        {
            "bidder_id": "B003",
            "name": "Gamma Civil Co",
            "beneficial_owners": [{"name": "Maya Ortiz"}],
            "submission_metadata": {
                "ip_address": "198.51.100.12",
                "bank_routing_code": "071000013",
            },
            "declared_assets": ["ASSET-3001", "ASSET-4001"],
        },
    ]

    scores = compute_bidder_scores(bidders)

    assert scores["B001"] > scores["B003"]
    assert scores["B002"] > scores["B003"]
    assert scores["B001"] >= 0.5
    assert scores["B002"] >= 0.5


def test_summary_flags_shared_networks_and_detects_cartel():
    bidders = [
        {
            "bidder_id": "B001",
            "name": "Alpha Construction Ltd",
            "beneficial_owners": [{"name": "Jane Doe"}],
            "submission_metadata": {
                "ip_address": "203.0.113.5",
                "bank_routing_code": "021000021",
            },
            "declared_assets": ["ASSET-1001"],
        },
        {
            "bidder_id": "B002",
            "name": "Beta Infra Works",
            "beneficial_owners": [{"name": "Jane Doe"}],
            "submission_metadata": {
                "ip_address": "203.0.113.5",
                "bank_routing_code": "021000021",
            },
            "declared_assets": ["ASSET-1001"],
        },
        {
            "bidder_id": "B003",
            "name": "Gamma Civil Co",
            "beneficial_owners": [{"name": "Maya Ortiz"}],
            "submission_metadata": {
                "ip_address": "198.51.100.42",
                "bank_routing_code": "091000019",
            },
            "declared_assets": ["ASSET-3001"],
        },
    ]

    summary = build_cartel_summary(bidders)

    assert summary["cartel_detected"] is True
    assert any("B001" in entry["bidders"] and "B002" in entry["bidders"] for entry in summary["flagged_networks"])
    assert summary["anomaly_scores"]["B001"] >= 0.5
    assert summary["anomaly_scores"]["B002"] >= 0.5

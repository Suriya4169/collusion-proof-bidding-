import random
import json
import csv
import os
from typing import List
from .schema import Bidder, PriceInput, PerformanceInput, LegalInput, FinancialInput, TechnicalInput, ClientPerformanceRecord

def generate_synthetic_dataset(
    count: int = 20,
    seed: int = 42
) -> List[Bidder]:
    """
    Generates a dataset of synthetic bidders.
    Includes normal randomized bidders and the following diagnostic edge cases:
      - B_brand_new: 0 projects, uniform prior yields 0.5 performance.
      - B_legal_test: honest disclosure of 2 minor civil + 1 tax violation.
      - B_legal_undisclosed: undisclosed case counts (2 minor civil + 1 tax violation) to test penalty.
      - B_cheap_but_weak: lowest bid amount but poor financials and tech.
      - B_fails_threshold: high technical specs but fails performance threshold.
      - B_colluder_A & B_colluder_B: share beneficial owner 'Owner_Alpha', share asset 'Truck_A123',
        and have identical/similar score profiles to test collusion anomaly detection.
    """
    if count < 7:
        raise ValueError("Count must be at least 7 to accommodate the required edge cases.")
        
    random.seed(seed)
    bidders = []
    
    # 1. Brand New Bidder
    bidders.append(Bidder(
        bidder_id="B_brand_new",
        price=PriceInput(bid_amount=400000.0),
        performance=PerformanceInput(records=[]),
        legal=LegalInput(self_declared_cases={}, verified_cases={}),
        financial=FinancialInput(
            liquidity=0.7, credit_rating=0.7, profitability=0.5,
            registration_age_years=3.0, turnover=120000.0
        ),
        technical=TechnicalInput(
            qualified_employees=15, equipment_availability=0.6,
            technology_maturity=3.0, relevant_experience_years=1.0,
            declared_assets=["Asset_BrandNew_1", "Asset_BrandNew_2"]
        ),
        beneficial_owners=["Owner_BrandNew"]
    ))
    
    # 2. Honest Legal Test Bidder (2 minor civil, 1 tax violation)
    bidders.append(Bidder(
        bidder_id="B_legal_test",
        price=PriceInput(bid_amount=450000.0),
        performance=PerformanceInput(records=[
            ClientPerformanceRecord(client_id="C1", successful_projects=15, failed_projects=1, verification_weight=1.0)
        ]),
        legal=LegalInput(
            self_declared_cases={"minor_civil": 2, "tax_violation": 1},
            verified_cases={"minor_civil": 2, "tax_violation": 1}
        ),
        financial=FinancialInput(
            liquidity=0.8, credit_rating=0.8, profitability=0.6,
            registration_age_years=5.0, turnover=250000.0
        ),
        technical=TechnicalInput(
            qualified_employees=25, equipment_availability=0.8,
            technology_maturity=6.0, relevant_experience_years=8.0,
            declared_assets=["Asset_LegalTest_1", "Asset_LegalTest_2"]
        ),
        beneficial_owners=["Owner_LegalTest"]
    ))
    
    # 3. Dishonest Legal Test Bidder (claims 0 cases, verified to have 2 minor civil, 1 tax violation)
    bidders.append(Bidder(
        bidder_id="B_legal_undisclosed",
        price=PriceInput(bid_amount=460000.0),
        performance=PerformanceInput(records=[
            ClientPerformanceRecord(client_id="C1", successful_projects=12, failed_projects=2, verification_weight=1.0)
        ]),
        legal=LegalInput(
            self_declared_cases={"minor_civil": 0, "tax_violation": 0},
            verified_cases={"minor_civil": 2, "tax_violation": 1}
        ),
        financial=FinancialInput(
            liquidity=0.8, credit_rating=0.8, profitability=0.6,
            registration_age_years=5.0, turnover=250000.0
        ),
        technical=TechnicalInput(
            qualified_employees=25, equipment_availability=0.8,
            technology_maturity=6.0, relevant_experience_years=8.0,
            declared_assets=["Asset_LegalUndisclosed_1"]
        ),
        beneficial_owners=["Owner_LegalUndisclosed"]
    ))
    
    # 4. Cheapest but Weakest Bidder (Price = 1.0 but fails gates/thresholds)
    bidders.append(Bidder(
        bidder_id="B_cheap_but_weak",
        price=PriceInput(bid_amount=150000.0),
        performance=PerformanceInput(records=[
            ClientPerformanceRecord(client_id="C2", successful_projects=10, failed_projects=2, verification_weight=0.9)
        ]),
        legal=LegalInput(),
        financial=FinancialInput(
            liquidity=0.1, credit_rating=0.1, profitability=0.05,
            registration_age_years=0.5, turnover=20000.0  # Fails eligibility age (0.5 < 2) & turnover (20000 < 100000)
        ),
        technical=TechnicalInput(
            qualified_employees=1, equipment_availability=0.1,
            technology_maturity=1.0, relevant_experience_years=0.5,
            declared_assets=[]
        ),
        beneficial_owners=["Owner_Cheap"]
    ))
    
    # 5. Fails a Minimum Performance Threshold (Perf_min = 0.4)
    # Success = 1, Fail = 15 -> (1 + 1) / (16 + 2) = 2/18 = 0.111 < 0.4
    bidders.append(Bidder(
        bidder_id="B_fails_threshold",
        price=PriceInput(bid_amount=250000.0),
        performance=PerformanceInput(records=[
            ClientPerformanceRecord(client_id="C3", successful_projects=1, failed_projects=15, verification_weight=1.0)
        ]),
        legal=LegalInput(),
        financial=FinancialInput(
            liquidity=0.9, credit_rating=0.9, profitability=0.8,
            registration_age_years=10.0, turnover=500000.0
        ),
        technical=TechnicalInput(
            qualified_employees=80, equipment_availability=0.95,
            technology_maturity=9.0, relevant_experience_years=15.0,
            declared_assets=["Asset_FailsThreshold_1"]
        ),
        beneficial_owners=["Owner_FailsThreshold"]
    ))
    
    # 6. Collusion Bidder A
    bidders.append(Bidder(
        bidder_id="B_colluder_A",
        price=PriceInput(bid_amount=380000.0),
        performance=PerformanceInput(records=[
            ClientPerformanceRecord(client_id="C4", successful_projects=20, failed_projects=2, verification_weight=1.0)
        ]),
        legal=LegalInput(),
        financial=FinancialInput(
            liquidity=0.75, credit_rating=0.75, profitability=0.6,
            registration_age_years=4.0, turnover=300000.0
        ),
        technical=TechnicalInput(
            qualified_employees=30, equipment_availability=0.75,
            technology_maturity=5.0, relevant_experience_years=6.0,
            declared_assets=["Asset_Colluder_ExclusiveA", "Asset_Shared_Truck_101"]
        ),
        beneficial_owners=["Owner_Alpha", "Owner_Beta"] # Shares Owner_Alpha
    ))
    
    # 7. Collusion Bidder B (Duplicates asset and shares owner, same specs to trigger score clustering)
    bidders.append(Bidder(
        bidder_id="B_colluder_B",
        price=PriceInput(bid_amount=382000.0), # Close bid price
        performance=PerformanceInput(records=[
            ClientPerformanceRecord(client_id="C4", successful_projects=20, failed_projects=2, verification_weight=1.0)
        ]),
        legal=LegalInput(),
        financial=FinancialInput(
            liquidity=0.75, credit_rating=0.75, profitability=0.6,
            registration_age_years=4.0, turnover=300000.0
        ),
        technical=TechnicalInput(
            qualified_employees=30, equipment_availability=0.75,
            technology_maturity=5.0, relevant_experience_years=6.0,
            declared_assets=["Asset_Colluder_ExclusiveB", "Asset_Shared_Truck_101"] # Duplicated technical asset
        ),
        beneficial_owners=["Owner_Alpha", "Owner_Gamma"] # Shares Owner_Alpha
    ))
    
    # Generate remaining randomized bidders
    for i in range(8, count + 1):
        bidder_id = f"B{i:03d}"
        
        bid_amount = round(random.uniform(220000, 750000), -3)
        
        # Performance history across 1 to 3 distinct clients
        records = []
        num_clients = random.randint(1, 3)
        for c_idx in range(num_clients):
            records.append(ClientPerformanceRecord(
                client_id=f"Client_{bidder_id}_{c_idx}",
                successful_projects=random.randint(5, 20),
                failed_projects=random.randint(0, 3),
                verification_weight=round(random.uniform(0.7, 1.0), 2)
            ))
            
        # Legal
        minor_civil = random.choices([0, 1, 2], weights=[0.85, 0.12, 0.03])[0]
        tax_violation = random.choices([0, 1], weights=[0.92, 0.08])[0]
        labour_law = random.choices([0, 1], weights=[0.97, 0.03])[0]
        
        self_declared = {
            "minor_civil": minor_civil,
            "tax_violation": tax_violation,
            "labour_law": labour_law
        }
        # In this dataset, normal bidders report honestly, so self_declared == verified
        verified = dict(self_declared)
        
        # Financials
        liquidity = round(random.uniform(0.4, 0.95), 2)
        credit_rating = round(random.uniform(0.5, 0.95), 2)
        profitability = round(random.uniform(0.2, 0.8), 2)
        registration_age_years = round(random.uniform(2.5, 15.0), 1)
        turnover = round(random.uniform(110000.0, 900000.0), -3)
        
        # Technical
        qualified_employees = random.randint(10, 100)
        equipment_availability = round(random.uniform(0.6, 1.0), 2)
        technology_maturity = float(random.randint(3, 10))
        relevant_experience_years = float(random.randint(2, 20))
        declared_assets = [f"Asset_{bidder_id}_{idx}" for idx in range(3)]
        
        bidders.append(Bidder(
            bidder_id=bidder_id,
            price=PriceInput(bid_amount=bid_amount),
            performance=PerformanceInput(records=records),
            legal=LegalInput(self_declared_cases=self_declared, verified_cases=verified),
            financial=FinancialInput(
                liquidity=liquidity,
                credit_rating=credit_rating,
                profitability=profitability,
                registration_age_years=registration_age_years,
                turnover=turnover
            ),
            technical=TechnicalInput(
                qualified_employees=qualified_employees,
                equipment_availability=equipment_availability,
                technology_maturity=technology_maturity,
                relevant_experience_years=relevant_experience_years,
                declared_assets=declared_assets
            ),
            beneficial_owners=[f"Owner_{bidder_id}_1", f"Owner_{bidder_id}_2"]
        ))
        
    return bidders

def save_dataset(bidders: List[Bidder], output_dir: str):
    """
    Saves the generated dataset to JSON and CSV formats.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Save JSON
    json_path = os.path.join(output_dir, "bidders_hardened.json")
    bidders_data = [b.model_dump() for b in bidders]
    with open(json_path, 'w') as f:
        json.dump(bidders_data, f, indent=2)
        
    # Save CSV
    csv_path = os.path.join(output_dir, "bidders_hardened.csv")
    with open(csv_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            "bidder_id", "bid_amount", "unique_clients_count", "total_success_projects", "total_failed_projects",
            "self_declared_civil_cases", "verified_civil_cases", "self_declared_tax_cases", "verified_tax_cases",
            "liquidity", "credit_rating", "profitability", "registration_age_years", "turnover",
            "qualified_employees", "equipment_availability", "technology_maturity", "relevant_experience_years",
            "declared_assets_count", "beneficial_owners"
        ])
        for b in bidders:
            total_success = sum(r.successful_projects for r in b.performance.records)
            total_failed = sum(r.failed_projects for r in b.performance.records)
            writer.writerow([
                b.bidder_id,
                b.price.bid_amount,
                len(b.performance.records),
                total_success,
                total_failed,
                b.legal.self_declared_cases.get("minor_civil", 0),
                b.legal.verified_cases.get("minor_civil", 0),
                b.legal.self_declared_cases.get("tax_violation", 0),
                b.legal.verified_cases.get("tax_violation", 0),
                b.financial.liquidity,
                b.financial.credit_rating,
                b.financial.profitability,
                b.financial.registration_age_years,
                b.financial.turnover,
                b.technical.qualified_employees,
                b.technical.equipment_availability,
                b.technical.technology_maturity,
                b.technical.relevant_experience_years,
                len(b.technical.declared_assets),
                ",".join(b.beneficial_owners)
            ])

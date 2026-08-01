import random
import json
import csv
import os
from typing import List
from .schema import Bidder, PriceInput, PerformanceInput, LegalInput, FinancialInput, TechnicalInput

def generate_synthetic_dataset(
    count: int = 20,
    seed: int = 42
) -> List[Bidder]:
    """
    Generates a configurable number of synthetic bidders with realistic randomized values,
    plus four specific hand-checkable edge cases.
    """
    if count < 4:
        raise ValueError("Count must be at least 4 to accommodate the required edge cases.")
        
    random.seed(seed)
    bidders = []
    
    # 1. Edge Case: Brand-new bidder (should score Perf = 0.5 under default prior)
    bidders.append(Bidder(
        bidder_id="B_brand_new",
        price=PriceInput(bid_amount=400000.0),
        performance=PerformanceInput(successful_projects=0, failed_projects=0),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.7, credit_rating=0.7, profitability=0.5),
        technical=TechnicalInput(
            qualified_employees=15,
            equipment_availability=0.6,
            technology_maturity=3.0,
            relevant_experience_years=1.0
        )
    ))
    
    # 2. Edge Case: Legal test bidder (2 minor civil + 1 tax violation -> Legal_Trust = e^-0.7)
    bidders.append(Bidder(
        bidder_id="B_legal_test",
        price=PriceInput(bid_amount=450000.0),
        performance=PerformanceInput(successful_projects=15, failed_projects=1),
        legal=LegalInput(minor_civil=2, tax_violation=1),
        financial=FinancialInput(liquidity=0.8, credit_rating=0.8, profitability=0.6),
        technical=TechnicalInput(
            qualified_employees=25,
            equipment_availability=0.8,
            technology_maturity=6.0,
            relevant_experience_years=8.0
        )
    ))
    
    # 3. Edge Case: Cheapest but weakest on technical/financial
    bidders.append(Bidder(
        bidder_id="B_cheap_but_weak",
        price=PriceInput(bid_amount=150000.0), # lowest price
        performance=PerformanceInput(successful_projects=10, failed_projects=2),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.1, credit_rating=0.1, profitability=0.05),
        technical=TechnicalInput(
            qualified_employees=1,
            equipment_availability=0.1,
            technology_maturity=1.0,
            relevant_experience_years=0.5
        )
    ))
    
    # 4. Edge Case: Fails a minimum threshold (e.g., Performance threshold Perf_min = 0.4)
    # Success = 1, Fail = 15 -> Perf = (1+1)/(1+15+1+1) = 2/18 = 0.111 < 0.4
    bidders.append(Bidder(
        bidder_id="B_fails_threshold",
        price=PriceInput(bid_amount=250000.0),
        performance=PerformanceInput(successful_projects=1, failed_projects=15),
        legal=LegalInput(),
        financial=FinancialInput(liquidity=0.9, credit_rating=0.9, profitability=0.8),
        technical=TechnicalInput(
            qualified_employees=80,
            equipment_availability=0.95,
            technology_maturity=9.0,
            relevant_experience_years=15.0
        )
    ))
    
    # Generate remaining randomized bidders
    for i in range(5, count + 1):
        bidder_id = f"B{i:03d}"
        
        # Ensure bid amount is higher than B_cheap_but_weak
        bid_amount = round(random.uniform(220000, 750000), -3)
        
        successful_projects = random.randint(5, 50)
        failed_projects = random.randint(0, 5)
        
        # Legal cases: mostly 0, occasionally minor civil/tax
        minor_civil = random.choices([0, 1, 2], weights=[0.8, 0.15, 0.05])[0]
        tax_violation = random.choices([0, 1], weights=[0.9, 0.1])[0]
        labour_law = random.choices([0, 1], weights=[0.95, 0.05])[0]
        environmental = random.choices([0, 1], weights=[0.98, 0.02])[0]
        
        liquidity = round(random.uniform(0.4, 0.95), 2)
        credit_rating = round(random.uniform(0.5, 0.95), 2)
        profitability = round(random.uniform(0.2, 0.8), 2)
        
        qualified_employees = random.randint(10, 100)
        equipment_availability = round(random.uniform(0.6, 1.0), 2)
        technology_maturity = float(random.randint(3, 10))
        relevant_experience_years = float(random.randint(2, 20))
        
        bidders.append(Bidder(
            bidder_id=bidder_id,
            price=PriceInput(bid_amount=bid_amount),
            performance=PerformanceInput(successful_projects=successful_projects, failed_projects=failed_projects),
            legal=LegalInput(
                minor_civil=minor_civil,
                tax_violation=tax_violation,
                labour_law=labour_law,
                environmental=environmental
            ),
            financial=FinancialInput(
                liquidity=liquidity,
                credit_rating=credit_rating,
                profitability=profitability
            ),
            technical=TechnicalInput(
                qualified_employees=qualified_employees,
                equipment_availability=equipment_availability,
                technology_maturity=technology_maturity,
                relevant_experience_years=relevant_experience_years
            )
        ))
        
    return bidders

def save_dataset(bidders: List[Bidder], output_dir: str):
    """
    Saves the generated dataset to data/ folder in JSON and CSV format.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Save JSON
    json_path = os.path.join(output_dir, "bidders.json")
    bidders_data = [b.model_dump() for b in bidders]
    with open(json_path, 'w') as f:
        json.dump(bidders_data, f, indent=2)
        
    # Save CSV
    csv_path = os.path.join(output_dir, "bidders.csv")
    with open(csv_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            "bidder_id", "bid_amount", "successful_projects", "failed_projects",
            "minor_civil", "tax_violation", "labour_law", "environmental", 
            "blacklisting", "corruption_fraud", "liquidity", "credit_rating", 
            "profitability", "qualified_employees", "equipment_availability", 
            "technology_maturity", "relevant_experience_years"
        ])
        for b in bidders:
            writer.writerow([
                b.bidder_id,
                b.price.bid_amount,
                b.performance.successful_projects,
                b.performance.failed_projects,
                b.legal.minor_civil,
                b.legal.tax_violation,
                b.legal.labour_law,
                b.legal.environmental,
                b.legal.blacklisting,
                b.legal.corruption_fraud,
                b.financial.liquidity,
                b.financial.credit_rating,
                b.financial.profitability,
                b.technical.qualified_employees,
                b.technical.equipment_availability,
                b.technical.technology_maturity,
                b.technical.relevant_experience_years
            ])

import math
from datetime import datetime
from src.models.schemas import PaymentPenaltyReport

# RBI Bank Rate (as of recent times, approx 6.5%)
# MSME Act says 3x the bank rate.
RBI_BANK_RATE_PERCENT = 6.5
PENALTY_RATE_PERCENT = RBI_BANK_RATE_PERCENT * 3

def calculate_payment_penalty(
    invoice_date_str: str, 
    payment_date_str: str, 
    principal_amount: float,
    company_name: str,
    buyer_name: str
) -> PaymentPenaltyReport:
    """
    Sub-Agent 1.10: Payment Delay Tracker (Section 16 of MSMED Act)
    Calculates compounding interest penalties for delayed government payments.
    """
    try:
        # 1. Parse dates (format: YYYY-MM-DD)
        invoice_date = datetime.strptime(invoice_date_str, "%Y-%m-%d")
        payment_date = datetime.strptime(payment_date_str, "%Y-%m-%d")
        
        # 2. Calculate days delayed
        delta = payment_date - invoice_date
        days_delayed = delta.days
        
        # 3. Check Section 16 applicability (45 days)
        if days_delayed <= 45:
            return PaymentPenaltyReport(
                days_overdue=0,
                is_penalty_applicable=False,
                penalty_amount_inr=0.0,
                demand_notice_draft="No penalty applicable. Payment received within the 45-day MSME Act window."
            )
            
        days_overdue = days_delayed - 45
        
        # 4. Calculate Compounding Interest
        # Formula for compound interest: A = P(1 + r/n)^(nt)
        # For MSME Act, interest is compounded monthly.
        months_overdue = math.ceil(days_overdue / 30.0)
        rate_decimal = PENALTY_RATE_PERCENT / 100.0
        
        # Principal + Interest
        total_amount = principal_amount * (1 + rate_decimal/12) ** months_overdue
        penalty_amount = total_amount - principal_amount
        
        # 5. Generate Legal Demand Notice
        draft_notice = f"""
[DRAFT LEGAL DEMAND NOTICE UNDER MSMED ACT, 2006]

To,
{buyer_name}

Subject: Demand for payment of principal amount and interest under Section 16 of the MSMED Act, 2006.

Sir/Madam,

This is to bring to your notice that an invoice dated {invoice_date_str} for the principal amount of ₹{principal_amount:,.2f} was raised by {company_name}. 
As per the MSME Development Act, 2006, payments must be cleared within 45 days. 

The payment was delayed by {days_overdue} days beyond the 45-day limit. 
Under Section 16, you are liable to pay compound interest with monthly rests at 3 times the bank rate notified by the RBI ({PENALTY_RATE_PERCENT}% p.a.).

Therefore, an interest penalty of ₹{penalty_amount:,.2f} is applicable and payable immediately.

Regards,
{company_name}
"""

        return PaymentPenaltyReport(
            days_overdue=days_overdue,
            is_penalty_applicable=True,
            penalty_amount_inr=round(penalty_amount, 2),
            demand_notice_draft=draft_notice.strip()
        )
        
    except ValueError:
        raise ValueError("Dates must be in YYYY-MM-DD format.")

if __name__ == "__main__":
    # Test case: 5 lakh invoice delayed by 90 days total (45 days overdue)
    report = calculate_payment_penalty("2025-01-01", "2025-04-01", 500000.0, "Bharat Engineering", "Govt Department XYZ")
    print(report.model_dump_json(indent=2))

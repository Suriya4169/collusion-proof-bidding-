# How to Download Tender PDFs — Step by Step

## Recording of GeM Portal Navigation

![GeM Portal Browse Recording](C:/Users/DELL/.gemini/antigravity-ide/brain/fdbd9dc5-78d6-4158-9569-a87d92711a99/gem_portal_browse_1787246959577.webp)

---

## Step 1: Download Tender PDFs from GeM

### Direct Link (No Login Needed!)

👉 **Go to: [https://bidplus.gem.gov.in/all-bids](https://bidplus.gem.gov.in/all-bids)**

No signup, no login — it's 100% public.

### What You'll See

A list of active government bids like this:

| Column | Example |
|---|---|
| **BID NO** | `GEM/2026/B/7821618` ← **click this to download PDF** |
| **Items** | "Supply of Office Furniture" |
| **Quantity** | 500 |
| **Department** | "Ministry of Railways" |
| **Start / End Date** | "01-Aug-2026 / 15-Aug-2026" |

### How to Download

1. Open [https://bidplus.gem.gov.in/all-bids](https://bidplus.gem.gov.in/all-bids)
2. You'll see a list of bids
3. **Click on any BID NO** (the blue link like `GEM/2026/B/7821618`)
4. A **PDF file downloads automatically** to your Downloads folder
5. That's it! 

### Download 5 Different Tenders

Pick a variety to test your Agent 1:

| # | What to Look For | Why |
|---|---|---|
| **Tender 1** | A short one (5-10 pages) | Easy to test, fast processing |
| **Tender 2** | A medium one (30-50 pages) | Realistic size |
| **Tender 3** | A long one (80-100+ pages) | Stress test for chunking |
| **Tender 4** | One with tables (EMD in a table) | Test table extraction |
| **Tender 5** | One in Hindi/bilingual | Test language handling |

### Where to Save Them

Create this folder:
```
d:\Final_year_Project\backend\test_data\
├── tender_short.pdf        (5-10 pages)
├── tender_medium.pdf       (30-50 pages)
├── tender_long.pdf         (80-100 pages)
├── tender_with_tables.pdf
└── tender_bilingual.pdf
```

---

## Step 2: Create Fake Corrigendum (For Agent 5)

You can't easily find real corrigenda. So **make your own** — this is actually better for testing because you know exactly what was changed.

### How to Create a Test Corrigendum

1. Take one of your downloaded tender PDFs
2. Open it and **copy the text** into a Word document (or Google Doc)
3. Save it as `original_tender.pdf`
4. Make a **copy** of the same document
5. **Change 3-4 sentences** deliberately:

| Original Sentence | Tampered Sentence | What Changed |
|---|---|---|
| "EMD amount is ₹50,000" | "EMD amount is ₹5,000" | 💰 Reduced EMD (corruption!) |
| "Minimum 5 years experience" | "Minimum 1 year experience" | 📉 Lowered bar for a friend |
| "Deadline: 15 August 2026" | "Deadline: 30 August 2026" | 📅 Extended for someone |
| "Open to Micro and Small" | "Open to Medium enterprises only" | 🚫 Excluded small players |

6. Save the changed version as `tampered_corrigendum.pdf`

### Save Them Here
```
d:\Final_year_Project\backend\test_data\
├── ...existing tender files...
├── original_tender.pdf       (the real one)
└── tampered_corrigendum.pdf  (your manually changed copy)
```

> **Why make your own?** When you demo Agent 5, you can tell the professor: *"I deliberately changed the EMD from ₹50K to ₹5K, and my AI caught it with 0.62 similarity score — flagged as HIGH severity."* This proves your system works.

---

## Step 3: Create Fake MSME Profiles (For Compliance Checking)

Create a JSON file with 3 test profiles. You'll use these to test the Traffic Light scoring.

### Save this file as `d:\Final_year_Project\backend\test_data\test_profiles.json`:

```json
[
  {
    "profile_name": "Weak Micro Enterprise (Should FAIL most)",
    "user_id": "usr_001",
    "company_name": "Ravi Small Traders",
    "udyam_number": "UDYAM-TN-02-0001234",
    "gst_number": "33AABCR1234A1Z5",
    "category": "Micro",
    "annual_turnover": 3500000,
    "experience_years": 1,
    "certifications": ["Udyam Registration"],
    "state": "Tamil Nadu"
  },
  {
    "profile_name": "Medium Enterprise (Should PASS some)",
    "user_id": "usr_002",
    "company_name": "Sharma Industries Pvt Ltd",
    "udyam_number": "UDYAM-MH-01-0012345",
    "gst_number": "27AABCS1429B1Z5",
    "category": "Small",
    "annual_turnover": 20000000,
    "experience_years": 5,
    "certifications": ["Udyam Registration", "ISO 9001"],
    "state": "Maharashtra"
  },
  {
    "profile_name": "Strong Enterprise (Should PASS most)",
    "user_id": "usr_003",
    "company_name": "TechBuild Solutions Ltd",
    "udyam_number": "UDYAM-KA-03-0099999",
    "gst_number": "29AABCT5678B1Z9",
    "category": "Medium",
    "annual_turnover": 150000000,
    "experience_years": 12,
    "certifications": ["Udyam Registration", "ISO 9001", "ISO 14001", "MSME Certificate"],
    "state": "Karnataka"
  }
]
```

---

## Summary — Your Data Checklist

| # | What | Where to Get | Save As |
|---|---|---|---|
| ✅ | 5 tender PDFs | [bidplus.gem.gov.in/all-bids](https://bidplus.gem.gov.in/all-bids) → click BID NO | `test_data/tender_*.pdf` |
| ✅ | 1 original + 1 tampered PDF | Copy a tender → change 3-4 sentences | `test_data/original_tender.pdf` + `tampered_corrigendum.pdf` |
| ✅ | 3 MSME profiles | Copy the JSON above | `test_data/test_profiles.json` |

**That's ALL the data you need.** No datasets, no Kaggle, no web scraping — just government PDFs from a public website + some test files you create yourself.

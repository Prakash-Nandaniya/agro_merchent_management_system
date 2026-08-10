import asyncio
import random
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

# Fallback for num2words if not installed
try:
    from num2words import num2words
except ImportError:
    num2words = None

# Import AsyncSessionLocal directly from your app's session module
from app.database.session import AsyncSessionLocal

# Import your SQLAlchemy models
from app.database.models.invoice import Invoice  # Adjust module path if needed
from app.database.models.trade import Trade      # Adjust module path if needed

# ==========================================
# CONFIGURATION & REALISTIC SEED DATA
# ==========================================

CROP_CONFIG = {
    "WHEAT": {"hsn": "1001", "cgst": Decimal("0.0"), "sgst": Decimal("0.0"), "uqc": "QTL", "min_rate": 2200, "max_rate": 2650},
    "COTTON": {"hsn": "5201", "cgst": Decimal("2.5"), "sgst": Decimal("2.5"), "uqc": "QTL", "min_rate": 6800, "max_rate": 7800},
    "GROUNDNUT": {"hsn": "1202", "cgst": Decimal("2.5"), "sgst": Decimal("2.5"), "uqc": "QTL", "min_rate": 5800, "max_rate": 6700},
    "MAG (GREEN GRAM)": {"hsn": "071331", "cgst": Decimal("0.0"), "sgst": Decimal("0.0"), "uqc": "QTL", "min_rate": 7100, "max_rate": 8300},
    "JEERU (CUMIN SEEDS)": {"hsn": "0909", "cgst": Decimal("2.5"), "sgst": Decimal("2.5"), "uqc": "QTL", "min_rate": 21000, "max_rate": 28500},
    "DHANA (CORIANDER SEEDS)": {"hsn": "0909", "cgst": Decimal("2.5"), "sgst": Decimal("2.5"), "uqc": "QTL", "min_rate": 6500, "max_rate": 8600},
}

SELLER_DATA = {
    "name": "Karma Trading",
    "address": "0, Baloch Road, Baloch PRA Shala, NEAR RAM MANDIR, Baloch, Porbandar, Gujarat, 362650",
    "pan": "BGVPN1601C",
    "gstin": "24BGVPN1601C1ZP",
    "bank": "HDFC BANK",
    "account": "99999512999515",
    "ifsc": "HDFC0002644",
    "terms": "As per provided in the Quotation and Order Form."
}

# 20 Realistic APMC Traders, Cotton Mills, Solvex & Oil Mills across Gujarat
REALISTIC_PARTIES = [
    {"name": "Maruti Agro Oil Mill", "city": "Rajkot", "state": "Gujarat", "pan": "ABCDE1234F", "gstin": "24ABCDE1234F1Z1", "address": "Plot 12, GIDC Phase 2, Rajkot, Gujarat 360002"},
    {"name": "Shree Ram Ginning & Pressing", "city": "Gondal", "state": "Gujarat", "pan": "BCDEF2345G", "gstin": "24BCDEF2345G1Z2", "address": "National Highway 8B, Gondal, Gujarat 360311"},
    {"name": "Sardar Patel Agro Industries", "city": "Junagadh", "state": "Gujarat", "pan": "CDEFG3456H", "gstin": "24CDEFG3456H1Z3", "address": "Dhoraji Road, Junagadh, Gujarat 362001"},
    {"name": "Jay Jalaram Commodities Trading", "city": "Unjha", "state": "Gujarat", "pan": "DEFGH4567I", "gstin": "24DEFGH4567I1Z4", "address": "APMC Market Yard, Unjha, Gujarat 384170"},
    {"name": "Girnar Spices & Grains Pvt Ltd", "city": "Porbandar", "state": "Gujarat", "pan": "EFGHI5678J", "gstin": "24EFGHI5678J1Z5", "address": "Bhavsinhji Road, Porbandar, Gujarat 360575"},
    {"name": "Kisan Bio Foods & Processing", "city": "Ahmedabad", "state": "Gujarat", "pan": "FGHIJ6789K", "gstin": "24FGHIJ6789K1Z6", "address": "Sarkhej-Gandhinagar Highway, Ahmedabad, Gujarat 380054"},
    {"name": "Mahadev Cotton & Solvex", "city": "Kadi", "state": "Gujarat", "pan": "GHIJK7890L", "gstin": "24GHIJK7890L1Z7", "address": "GIDC Estate, Kadi, Mehsana, Gujarat 382715"},
    {"name": "Ganesh Oil Extractions", "city": "Amreli", "state": "Gujarat", "pan": "HIJKL8901M", "gstin": "24HIJKL8901M1Z8", "address": "Chital Road, Amreli, Gujarat 365601"},
    {"name": "Dhanlaxmi Spices Traders", "city": "Halvad", "state": "Gujarat", "pan": "IJKLM9012N", "gstin": "24IJKLM9012N1Z9", "address": "APMC Yard, Halvad, Morbi, Gujarat 363330"},
    {"name": "Ambica Agro Processing Co.", "city": "Deesa", "state": "Gujarat", "pan": "JKLMN0123O", "gstin": "24JKLMN0123O1ZA", "address": "Palanpur Highway, Deesa, Banaskantha, Gujarat 385535"},
    {"name": "Somnath Grain Merchants", "city": "Veraval", "state": "Gujarat", "pan": "KLMNO1234P", "gstin": "24KLMNO1234P1ZB", "address": "Bypass Road, Veraval, Gir Somnath, Gujarat 362265"},
    {"name": "Chamunda Ginning Mill", "city": "Jasdan", "state": "Gujarat", "pan": "LMNOP2345Q", "gstin": "24LMNOP2345Q1ZC", "address": "Atkot Road, Jasdan, Rajkot, Gujarat 360050"},
    {"name": "Tirupati Oil Industries", "city": "Jamnagar", "state": "Gujarat", "pan": "MNOPQ3456R", "gstin": "24MNOPQ3456R1ZD", "address": "Phase 3 GIDC, Jamnagar, Gujarat 361004"},
    {"name": "Rudra Spices & Export Co.", "city": "Patan", "state": "Gujarat", "pan": "NOPQR4567S", "gstin": "24NOPQR4567S1ZE", "address": "Chanasma Highway, Patan, Gujarat 384265"},
    {"name": "Gopala Commodities Pvt Ltd", "city": "Morbi", "state": "Gujarat", "pan": "OPQRS5678T", "gstin": "24OPQRS5678T1ZF", "address": "Sanala Road, Morbi, Gujarat 363641"},
    {"name": "Shubham Agro Tech", "city": "Visnagar", "state": "Gujarat", "pan": "PQRST6789U", "gstin": "24PQRST6789U1ZG", "address": "Mehsana Road, Visnagar, Gujarat 384315"},
    {"name": "Vrajbhumi Seeds & Grains", "city": "Dhoraji", "state": "Gujarat", "pan": "QRSTU7890V", "gstin": "24QRSTU7890V1ZH", "address": "APMC Complex, Dhoraji, Rajkot, Gujarat 360410"},
    {"name": "Bhakti Oil & Extraction", "city": "Bhavnagar", "state": "Gujarat", "pan": "RSTUV8901W", "gstin": "24RSTUV8901W1ZI", "address": "Chitra GIDC, Bhavnagar, Gujarat 364004"},
    {"name": "Navrang Cotton Fibres", "city": "Bodeli", "state": "Gujarat", "pan": "STUVW9012X", "gstin": "24STUVW9012X1ZJ", "address": "Station Road, Bodeli, Chhota Udepur, Gujarat 391135"},
    {"name": "Harsiddhi Agro Exporters", "city": "Surat", "state": "Gujarat", "pan": "TUVWX0123Y", "gstin": "24TUVWX0123Y1ZK", "address": "Ring Road, Surat, Gujarat 395002"}
]

TRANSPORTERS = [
    "Shreeji Transport Co.", "Mahavir Logistics", "Gujarat Surface Carriers", 
    "VRL Logistics Ltd.", "Patel Roadways", "Apex Cargo Movers", "Rajkot Freight Carrier"
]

DELIVERY_METHODS = ["By Road", "Transport", "Direct Truck"]

def amount_to_indian_words(amount: Decimal) -> str:
    """Converts Decimal monetary value to Indian Rupee Words format."""
    rupees = int(amount)
    paise = int(round((amount - rupees) * 100))
    
    if num2words:
        words = num2words(rupees, lang='en_IN').title() + " Rupees"
        if paise > 0:
            words += " And " + num2words(paise, lang='en_IN').title() + " Paise"
        return words + " Only"
    else:
        return f"Rupees {rupees} And {paise} Paise Only"

def generate_vehicle_no() -> str:
    series = random.choice(["GJ11", "GJ03", "GJ10", "GJ01", "GJ06", "GJ08", "GJ12", "GJ05"])
    alpha = random.choice(["AB", "TT", "X", "Y", "Z", "TR", "UU"])
    num = random.randint(1000, 9999)
    return f"{series} {alpha} {num}"

def generate_eway_bill() -> str:
    return str(random.randint(100000000000, 999999999999))

# ==========================================
# MAIN SEEDING FUNCTION
# ==========================================

async def seed_bulk_data(total_trades: int = 1000, start_invoice_no: int = 1516):
    current_inv_seq = start_invoice_no
    invoices_created_count = 0
    trades_created_count = 0

    print(f"🚀 Starting database seed script...")
    print(f"📊 Target: {total_trades} Trades (~90% with Invoices starting at #{start_invoice_no})")

    async with AsyncSessionLocal() as session:
        # Spread trading dates across the past 8 months
        start_date = datetime.now() - timedelta(days=240)

        for i in range(total_trades):
            # Determine whether this trade gets an invoice (~90% chance)
            has_invoice = random.random() < 0.90
            
            # Select random crop & party from the 20 real parties
            crop_name, crop_meta = random.choice(list(CROP_CONFIG.items()))
            party = random.choice(REALISTIC_PARTIES)

            # Date calculation
            created_datetime = start_date + timedelta(days=(i * 240 // total_trades), hours=random.randint(1, 14))
            trade_date = created_datetime.date()

            # Quantities & Mandi Rates
            qty = Decimal(str(round(random.uniform(60.0, 380.0), 2))) # 60 to 380 Quintals
            rate = Decimal(str(random.randint(crop_meta["min_rate"], crop_meta["max_rate"])))

            taxable_amount = (qty * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            
            cgst_rate = crop_meta["cgst"]
            sgst_rate = crop_meta["sgst"]

            cgst_amount = (taxable_amount * (cgst_rate / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            sgst_amount = (taxable_amount * (sgst_rate / Decimal("100"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            final_amount = taxable_amount + cgst_amount + sgst_amount
            final_words = amount_to_indian_words(final_amount)

            # Calculate trade financials
            gst_total = cgst_amount + sgst_amount
            tds_deducted = (taxable_amount * Decimal("0.001")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) # 0.1% TDS u/s 194Q
            mill_payment = final_amount - tds_deducted

            farmer_payment = (taxable_amount * Decimal("0.92")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            transport_cost = Decimal(str(random.randint(4000, 18000)))
            labour_cost = (qty * Decimal("15.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            other_cost = Decimal(str(random.randint(300, 1800)))

            vehicle_no = generate_vehicle_no()
            invoice_no_val = None

            # Create Invoice if selected by probability
            if has_invoice:
                invoice_no_val = str(current_inv_seq)
                
                invoice = Invoice(
                    created_at=created_datetime,
                    updated_at=created_datetime,
                    created_by="system_seeder",
                    seller_name=SELLER_DATA["name"],
                    seller_address=SELLER_DATA["address"],
                    seller_pan=SELLER_DATA["pan"],
                    seller_gstin=SELLER_DATA["gstin"],
                    invoice_no=invoice_no_val,
                    invoice_date=trade_date,
                    eway_bill_no=generate_eway_bill(),
                    docket_no=f"DK-{random.randint(10000, 99999)}",
                    transport_name=random.choice(TRANSPORTERS),
                    delivery_through=random.choice(DELIVERY_METHODS),
                    party_name=party["name"],
                    party_address=party["address"],
                    party_city=party["city"],
                    party_state=party["state"],
                    party_gstin=party["gstin"],
                    party_pan=party["pan"],
                    crop=crop_name,
                    hsn_code=crop_meta["hsn"],
                    qty=qty,
                    uqc=crop_meta["uqc"],
                    rate=rate,
                    taxable_amount=taxable_amount,
                    cgst_rate=cgst_rate,
                    sgst_rate=sgst_rate,
                    cgst_amount=cgst_amount,
                    sgst_amount=sgst_amount,
                    final_amount=final_amount,
                    final_amount_in_words=final_words,
                    seller_bank=SELLER_DATA["bank"],
                    seller_account=SELLER_DATA["account"],
                    seller_ifsc=SELLER_DATA["ifsc"],
                    terms=SELLER_DATA["terms"]
                )
                session.add(invoice)
                invoices_created_count += 1
                current_inv_seq += 1

            # Create Trade Record
            trade = Trade(
                created_at=created_datetime,
                updated_at=created_datetime,
                created_by="system_seeder",
                trade_creation_date=created_datetime,
                invoice_no=invoice_no_val, # Set to string if invoice exists, otherwise None (NULL)
                crop_name=crop_name,
                vehicle_no=vehicle_no,
                party_name=party["name"],
                mill_qty=qty,
                mill_qty_unit=crop_meta["uqc"],
                mill_rate=rate,
                mill_rate_unit=f"RS/{crop_meta['uqc']}",
                gst_collected=gst_total,
                tds_deducted=tds_deducted,
                mill_payment=mill_payment,
                farmer_payment=farmer_payment,
                transport_cost=transport_cost,
                labour_cost=labour_cost,
                other_cost=other_cost,
                note=f"Dispatch vehicle {vehicle_no} to {party['name']}." if has_invoice else "Direct APMC Mandi trade without bill.",
                mill_receipt=None  # Left empty (NULL) as requested
            )
            session.add(trade)
            trades_created_count += 1

            # Commit in batches of 100 for fast execution
            if (i + 1) % 100 == 0:
                await session.commit()
                print(f"  Processed {i + 1}/{total_trades} trades...")

        await session.commit()

    print("\n✅ SEEDING COMPLETE!")
    print(f" Total Trades Inserted : {trades_created_count}")
    print(f" Invoices Generated    : {invoices_created_count} (Invoices #{start_invoice_no} to #{current_inv_seq - 1})")
    print(f" Unbilled Trades       : {trades_created_count - invoices_created_count} (~10%)")

if __name__ == "__main__":
    asyncio.run(seed_bulk_data(total_trades=1000, start_invoice_no=1516))
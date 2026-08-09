"""Plain-English schema description fed to the SQL-generation LLM. Edit this,
and only this, when tables/columns change — nothing else introspects the DB."""

DB_SCHEMA_DESCRIPTION = """
You have READ-ONLY access to a PostgreSQL database with two tables.

Table: "Invoices"  (note the double quotes — the table name has a capital
"I" so it MUST be written as "Invoices" in SQL, not Invoices or invoices)
Columns:
- id (int, PK)
- created_at, updated_at (timestamp)
- created_by (varchar)
- seller_name, seller_address, seller_pan, seller_gstin (seller details)
- invoice_no (varchar, unique), invoice_date (date)
- eway_bill_no, docket_no, transport_name, delivery_through
- party_name, party_address, party_city, party_state, party_gstin, party_pan
  (the buyer / party the invoice is billed to)
- crop (varchar) — the crop/commodity sold on this invoice
- hsn_code (varchar)
- qty (numeric), uqc (varchar, unit e.g. KG/QTL)
- rate (numeric) — price per unit
- taxable_amount (numeric)
- cgst_rate, sgst_rate, cgst_amount, sgst_amount (numeric) — GST breakdown
- final_amount (numeric) — total invoice value including tax (this is the
  headline "invoice value" figure)
- final_amount_in_words (text)
- seller_bank, seller_account, seller_ifsc
- terms (text)

Table: trades  (lowercase, no quoting needed)
Columns:
- id (int, PK)
- created_at, updated_at, created_by
- trade_creation_date (timestamp)
- invoice_no (varchar, nullable — can be joined to "Invoices".invoice_no)
- crop_name (varchar)
- vehicle_no (varchar)
-- Inflow: money coming IN from selling the crop to a mill --
- party_name, mill_qty, mill_qty_unit, mill_rate, mill_rate_unit
- gst_collected, tds_deducted
- mill_payment (numeric) — amount received from the mill
-- Outflow: money paid OUT to run the trade --
- farmer_payment (numeric) — paid to the farmer for the crop
- transport_cost, labour_cost, other_cost (numeric)
- note (text), mill_receipt (text)

Business logic notes:
- "Invoices" = formal sales invoices billed to a party/buyer.
- "trades" = the full buy-sell cycle: buying from a farmer, selling to a
  mill, plus costs. Profit/margin on one trade =
      mill_payment - (farmer_payment + transport_cost + labour_cost + other_cost)
- invoice_no can link a trade to its Invoices row (LEFT JOIN on invoice_no).
- Money amounts are Postgres NUMERIC — cast/round in SQL if useful, but raw
  precision is fine too since results get post-processed in Python.

Rules:
- Only ever write a single SELECT statement (WITH/CTE prefix allowed).
- Never write INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, GRANT, CREATE.
- Always double-quote "Invoices" exactly like that. Never quote trades.
""".strip()


COMPANY_CONTEXT = """
Company: Karma Trading — a raw-crop trading business.
Business model: buys raw crop directly from farmers, then sells it onward to
wholesalers, flour/rice/dal mills, and other high-level buyers. Revenue comes
from the margin between what's paid to farmers (plus transport/labour/other
costs) and what's received from mills/wholesalers, plus formal invoice sales.
""".strip()
import json
import re
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

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
- Only ever write a single SELECT statement.
- Never write INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, GRANT, CREATE.
- Always double-quote "Invoices" exactly like that. Never quote trades.
"""

_FORBIDDEN_KEYWORDS = {
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
    "GRANT", "REVOKE", "CREATE", "EXEC", "EXECUTE", "MERGE", "CALL",
    "COPY", "VACUUM", "REINDEX",
}


def is_safe_select(sql_query: str) -> bool:
    q = sql_query.strip().rstrip(";").strip()
    if not q:
        return False
    if not q.upper().lstrip("(").startswith("SELECT") and not q.upper().startswith("WITH"):
        return False
    # reject stacked statements (a ; followed by more SQL)
    if ";" in sql_query.strip().rstrip(";"):
        return False
    tokens = re.findall(r"[A-Za-z]+", q.upper())
    if any(tok in _FORBIDDEN_KEYWORDS for tok in tokens):
        return False
    return True


def _json_safe(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def execute_readonly_query(db: Session, sql_query: str) -> list[dict]:
    """
    Runs a SELECT-only query and returns rows as a list of JSON-safe dicts.
    Raises ValueError if the query fails the app-level safety check, or
    PermissionError if Postgres itself rejects it (shouldn't happen given
    the ai_agent role is read-only, but handled just in case).
    """
    if not is_safe_select(sql_query):
        raise ValueError("Only a single SELECT statement is allowed.")

    try:
        result = db.execute(text(sql_query))
        rows = result.mappings().all()
        return [{k: _json_safe(v) for k, v in row.items()} for row in rows]
    except ProgrammingError as e:
        if "permission denied" in str(e).lower():
            raise PermissionError("Database rejected this query (read-only role).")
        raise


def rows_to_json(rows: list[dict]) -> str:
    return json.dumps(rows, default=str)


def _num(row: dict, col: str) -> float:
    v = row.get(col)
    return float(v) if v is not None else 0.0


def op_sum(data: list[dict], column: str) -> float:
    return sum(_num(r, column) for r in data)


def op_average(data: list[dict], column: str) -> float:
    vals = [_num(r, column) for r in data]
    return sum(vals) / len(vals) if vals else 0.0


def op_min(data: list[dict], column: str) -> float:
    vals = [_num(r, column) for r in data]
    return min(vals) if vals else 0.0


def op_max(data: list[dict], column: str) -> float:
    vals = [_num(r, column) for r in data]
    return max(vals) if vals else 0.0


def op_count(data: list[dict]) -> int:
    return len(data)


def op_group_sum(data: list[dict], group_by: str, value_column: str) -> dict:
    grouped: dict = {}
    for r in data:
        key = r.get(group_by)
        grouped[key] = grouped.get(key, 0.0) + _num(r, value_column)
    return grouped


def op_margin(data: list[dict], revenue_column: str, cost_columns: list[str]) -> float:
    revenue = sum(_num(r, revenue_column) for r in data)
    cost = sum(sum(_num(r, c) for c in cost_columns) for r in data)
    return revenue - cost


def op_percentage_of_total(data: list[dict], column: str) -> list[dict]:
    total = sum(_num(r, column) for r in data)
    out = []
    for r in data:
        pct = (_num(r, column) / total * 100) if total else 0.0
        out.append({**r, "pct_of_total": round(pct, 2)})
    return out


def apply_operations(data: list[dict], operations: list[dict]) -> dict:
    """
    operations: list of dicts like:
      {"op": "sum", "column": "final_amount"}
      {"op": "group_sum", "group_by": "crop", "value_column": "final_amount"}
      {"op": "margin", "revenue_column": "mill_payment",
       "cost_columns": ["farmer_payment", "transport_cost", "labour_cost", "other_cost"]}
    Returns a dict of results keyed descriptively.
    """
    results: dict = {}
    for op in operations:
        op_type = op.get("op")
        try:
            if op_type == "sum":
                results[f"sum_{op['column']}"] = op_sum(data, op["column"])
            elif op_type == "average":
                results[f"average_{op['column']}"] = op_average(data, op["column"])
            elif op_type == "min":
                results[f"min_{op['column']}"] = op_min(data, op["column"])
            elif op_type == "max":
                results[f"max_{op['column']}"] = op_max(data, op["column"])
            elif op_type == "count":
                results["count"] = op_count(data)
            elif op_type == "group_sum":
                key = f"group_sum_{op['group_by']}_by_{op['value_column']}"
                results[key] = op_group_sum(data, op["group_by"], op["value_column"])
            elif op_type == "margin":
                results["margin"] = op_margin(data, op["revenue_column"], op["cost_columns"])
            elif op_type == "percentage_of_total":
                results[f"pct_of_total_{op['column']}"] = op_percentage_of_total(data, op["column"])
            else:
                results[f"unsupported_op_{op_type}"] = "skipped"
        except Exception as e:
            results[f"error_{op_type}"] = str(e)
    return results
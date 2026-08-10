import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.chatbot.llmconfig import FINAL_ANALYSIS_MODEL, MATH_PLAN_MODEL, SQL_MODEL, make_llm
from app.chatbot.mathops import OPERATIONS_DESCRIPTION, run_math_plan
from app.chatbot.schemacontext import COMPANY_CONTEXT, DB_SCHEMA_DESCRIPTION
from app.chatbot.sqlguard import UnsafeSQLError, validate_select_only
from app.chatbot.state import MAX_SQL_RETRIES, AgentState

sql_llm = make_llm(SQL_MODEL)
math_planner_llm = make_llm(MATH_PLAN_MODEL)
final_llm = make_llm(FINAL_ANALYSIS_MODEL, temperature=0.2)


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _extract_json(raw: str) -> Any:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if "\n" in cleaned:
            cleaned = cleaned.split("\n", 1)[1]
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    return json.loads(cleaned)


# --------------------------------------------------------------------------
# 1. SQL generation (entry point + retry target)
# --------------------------------------------------------------------------

SQL_SYSTEM_PROMPT = f"""{COMPANY_CONTEXT}

{DB_SCHEMA_DESCRIPTION}

Write ONE PostgreSQL read-only SELECT query that answers the user's question.
Apply every filter implied (dates, party, crop, state, etc.) directly in SQL.
If a report/overview was requested and no specific filters were given, write
a broad summary query (recent period, grouped by crop/month as sensible).

If trend/forecast/growth-rate analysis will be needed downstream, ORDER BY
the relevant date/period column ascending so row order is meaningful.

Output ONLY JSON, no markdown fences: {{"sql": "...", "notes": "..."}}
"notes" is one sentence on what the query does, for the next processing step.
"""


async def generate_sql_node(state: AgentState) -> dict:
    if not state.get("needs_db", True):
        return {"sql_query": None, "sql_error": None}

    prompt = state["user_query"]
    if state.get("sql_feedback"):
        prompt += (
            f"\n\nYour previous query failed:\n{state['sql_feedback']}\n"
            "Fix the query and try again."
        )

    response = await sql_llm.ainvoke([SystemMessage(content=SQL_SYSTEM_PROMPT), HumanMessage(content=prompt)])
    try:
        parsed = _extract_json(response.content)
        sql = parsed["sql"]
    except (json.JSONDecodeError, KeyError, TypeError):
        return {"sql_query": None, "sql_error": "Could not parse a SQL query from the model."}

    if str(sql).strip().upper() == "NO_QUERY_NEEDED":
        return {"sql_query": None, "sql_error": None}

    return {"sql_query": sql, "sql_error": None}


# --------------------------------------------------------------------------
# 2. SQL execution (retry target's downstream)
# --------------------------------------------------------------------------


def make_execute_sql_node(db: AsyncSession):
    async def execute_sql_node(state: AgentState) -> dict:
        if not state.get("sql_query"):
            return {"raw_rows": [], "sql_error": None}

        try:
            safe_sql = validate_select_only(state["sql_query"])
        except UnsafeSQLError as e:
            return {
                "raw_rows": [],
                "sql_error": str(e),
                "sql_feedback": str(e),
                "sql_retry_count": state.get("sql_retry_count", 0) + 1,
            }

        try:
            result = await db.execute(text(safe_sql))
            columns = list(result.keys())
            rows = result.fetchall()
            data = [{col: _json_safe(v) for col, v in zip(columns, row)} for row in rows]
            return {"raw_rows": data, "sql_error": None, "sql_feedback": None}
        except (ProgrammingError, Exception) as e:  # noqa: BLE001
            err = str(getattr(e, "orig", e))
            return {
                "raw_rows": [],
                "sql_error": err,
                "sql_feedback": f"Query: {safe_sql}\nError: {err}",
                "sql_retry_count": state.get("sql_retry_count", 0) + 1,
            }

    return execute_sql_node


def route_after_execute_sql(state: AgentState) -> str:
    if state.get("sql_error") and state.get("sql_retry_count", 0) < MAX_SQL_RETRIES:
        return "generate_sql"
    return "plan_math"


# --------------------------------------------------------------------------
# 2b. Direct answer fallback for general crop/farming business knowledge
# --------------------------------------------------------------------------

async def direct_answer_node(state: AgentState) -> dict:
    prompt = (
        "You are a friendly agricultural business assistant. Answer this question "
        "using only general crop/farming/trading knowledge. Do not use any "
        "company-specific invoices, trades, or private data from Karma Trading."
    )
    response = await final_llm.ainvoke(
        [
            SystemMessage(content=prompt),
            HumanMessage(content=state["user_query"]),
        ]
    )
    return {"final_answer": response.content, "messages": [AIMessage(content=response.content)]}


# --------------------------------------------------------------------------
# 3. Math planning
# --------------------------------------------------------------------------

MATH_SYSTEM_PROMPT = f"""Decide what math/analytics operations to run on the query
result to answer the user's question well — go beyond a bare total when a
trend, comparison, or forecast would genuinely help (this is a business
analytics assistant, not just a calculator).

Available operations:
{OPERATIONS_DESCRIPTION}

Output ONLY JSON, no markdown fences: {{"plan": [{{"op": "...", ...args, "label": "..."}}]}}
- If the raw rows already fully answer the question (e.g. "list my invoices"),
  return {{"plan": []}}.
- Only reference columns that actually appear in the sample rows given.
- Use "custom" only when nothing in the catalog covers it — it's expensive
  (generates and runs new code), so prefer the standard catalog whenever it fits.
"""


async def plan_math_node(state: AgentState) -> dict:
    if state.get("sql_error") or not state.get("raw_rows"):
        return {"math_plan": []}

    columns = list(state["raw_rows"][0].keys())
    prompt = (
        f"User request: {state['user_query']}\n\n"
        f"Columns available: {columns}\n"
        f"Row count: {len(state['raw_rows'])}\n"
        f"Sample rows: {json.dumps(state['raw_rows'][:5], default=str)}"
    )
    response = await math_planner_llm.ainvoke([SystemMessage(content=MATH_SYSTEM_PROMPT), HumanMessage(content=prompt)])
    try:
        parsed = _extract_json(response.content)
        return {"math_plan": parsed.get("plan", [])}
    except (json.JSONDecodeError, TypeError):
        return {"math_plan": []}


# --------------------------------------------------------------------------
# 4. Math execution (pure python; custom ops get handed off to codegen.py)
# --------------------------------------------------------------------------


async def execute_math_node(state: AgentState) -> dict:
    if not state.get("math_plan"):
        return {"math_results": {}, "pending_custom_ops": []}
    results, pending_custom = run_math_plan(state["raw_rows"], state["math_plan"])
    return {"math_results": results, "pending_custom_ops": pending_custom}


def route_after_execute_math(state: AgentState) -> str:
    return "custom_codegen" if state.get("pending_custom_ops") else "final_analysis"


# --------------------------------------------------------------------------
# 5. Final analysis
# --------------------------------------------------------------------------

FINAL_SYSTEM_PROMPT = f"""{COMPANY_CONTEXT}

You are answering using ONLY the data, computed metrics, and web context
provided below. Never invent numbers not present in the input.

Formatting (frontend renders markdown with GFM tables and a `chart` fenced
block type via recharts):
- Default: 2-6 direct sentences with the actual numbers in them.
- Use a GFM markdown table for genuine row-by-row/side-by-side breakdowns.
- For a chart, ONE fenced block tagged `chart` with EXACTLY this JSON shape:
  {{"type": "bar"|"line"|"pie", "title": "...", "xKey": "...", "yKeys": ["..."], "data": [{{...}}]}}
  Only include a chart when it truly fits (trend/comparison across items) —
  never for a single number.
- If is_report is true: structure the answer with short markdown headers
  (## Overview, ## Trades, ## Margins, etc.) — still concise per section,
  not padded.
- If sql_error/custom_code_error are present, say briefly what couldn't be
  computed and answer with whatever data IS available — don't dead-end.
"""


async def final_analysis_node(state: AgentState) -> dict:
    context = {
        "user_request": state["user_query"],
        "is_report": state.get("is_report", False),
        "sql_error": state.get("sql_error"),
        "row_count": len(state.get("raw_rows", [])),
        "rows_sample": state.get("raw_rows", [])[:25],
        "computed_metrics": state.get("math_results", {}),
        "web_context": state.get("web_context") or None,
    }
    response = await final_llm.ainvoke(
        [SystemMessage(content=FINAL_SYSTEM_PROMPT), HumanMessage(content=json.dumps(context, default=str))]
    )
    final_text = response.content
    return {"final_answer": final_text, "messages": [AIMessage(content=final_text)]}
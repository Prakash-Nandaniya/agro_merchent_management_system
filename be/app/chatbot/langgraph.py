import json
from typing import Annotated, Optional, TypedDict

from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from sqlalchemy.orm import Session

from app.core.config import settings

from app.chatbot.tools import (
    DB_SCHEMA_DESCRIPTION,
    apply_operations,
    execute_readonly_query,
    rows_to_json,
)

def get_llm(temperature: float = 0.0) -> ChatOpenAI:
    return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=settings.OPENAI_API_KEY)


# ---------------------------------------------------------------------------
# Graph state
# ---------------------------------------------------------------------------
class AgentState(TypedDict):
    user_query: str
    messages: Annotated[list, add_messages]  # conversation memory, auto-appended
    sql_query: Optional[str]
    query_result_json: Optional[str]
    operations: Optional[list]
    operations_result: Optional[dict]
    final_answer: Optional[str]


# ---------------------------------------------------------------------------
# Node 1 — generate SQL from the user's question + conversation memory
# ---------------------------------------------------------------------------
SQL_SYSTEM_PROMPT = f"""You are a PostgreSQL query generator for a crop-trading business.

{DB_SCHEMA_DESCRIPTION}

Given the user's question and the conversation so far, write ONE single SELECT
query that answers it — apply the right WHERE filters, date ranges, JOINs,
GROUP BY, ORDER BY, and LIMIT as needed.

If the question does not require any database data (e.g. a greeting, or a
follow-up that can be answered from the conversation alone), respond with
exactly: NO_QUERY_NEEDED

Respond with ONLY the raw SQL (or NO_QUERY_NEEDED). No explanation, no
markdown code fences, no trailing semicolon commentary.
"""


def generate_sql_node(state: AgentState) -> dict:
    llm = get_llm()
    messages = [SystemMessage(content=SQL_SYSTEM_PROMPT)] + list(state.get("messages", [])) + [
        HumanMessage(content=state["user_query"])
    ]
    response = llm.invoke(messages)
    raw = response.content.strip().strip("`").strip()
    if raw.lower().startswith("sql"):
        raw = raw[3:].strip()

    sql_query = None if raw.upper() == "NO_QUERY_NEEDED" else raw
    return {"sql_query": sql_query}


# ---------------------------------------------------------------------------
# Node 2 — execute the SQL (read-only) and store rows as JSON
# ---------------------------------------------------------------------------
def execute_sql_node(state: AgentState, config: RunnableConfig) -> dict:
    sql_query = state.get("sql_query")
    if not sql_query:
        return {"query_result_json": "[]"}

    db: Session = config["configurable"]["db_session"]
    try:
        rows = execute_readonly_query(db, sql_query)
        return {"query_result_json": rows_to_json(rows)}
    except (ValueError, PermissionError) as e:
        return {"query_result_json": json.dumps({"error": str(e)})}


# ---------------------------------------------------------------------------
# Node 3 — decide what math/aggregation operations the question needs
# ---------------------------------------------------------------------------
OPERATIONS_SYSTEM_PROMPT = """You decide what math/aggregation operations to run
on a query result to answer the user's question.

Available ops (respond using EXACTLY these shapes):
- {"op": "sum", "column": "<col>"}
- {"op": "average", "column": "<col>"}
- {"op": "min", "column": "<col>"}
- {"op": "max", "column": "<col>"}
- {"op": "count"}
- {"op": "group_sum", "group_by": "<col>", "value_column": "<col>"}
- {"op": "margin", "revenue_column": "<col>", "cost_columns": ["<col>", "<col>", ...]}
- {"op": "percentage_of_total", "column": "<col>"}

Respond with ONLY a JSON array of operation objects. If no calculation is
needed (the raw rows already answer the question, e.g. "list my invoices"),
respond with exactly: []
"""


def identify_operations_node(state: AgentState) -> dict:
    llm = get_llm()
    context = (
        f"User question: {state['user_query']}\n\n"
        f"Query result data:\n{state.get('query_result_json', '[]')}"
    )
    messages = [SystemMessage(content=OPERATIONS_SYSTEM_PROMPT), HumanMessage(content=context)]
    response = llm.invoke(messages)
    raw = response.content.strip().strip("`")
    if raw.lower().startswith("json"):
        raw = raw[4:].strip()

    try:
        operations = json.loads(raw)
        if not isinstance(operations, list):
            operations = []
    except Exception:
        operations = []

    return {"operations": operations}


# ---------------------------------------------------------------------------
# Node 4 — actually run those operations in Python (deterministic, not LLM)
# ---------------------------------------------------------------------------
def apply_operations_node(state: AgentState) -> dict:
    try:
        data = json.loads(state.get("query_result_json") or "[]")
        if not isinstance(data, list):
            data = []
    except Exception:
        data = []

    results = apply_operations(data, state.get("operations") or [])
    return {"operations_result": results}


# ---------------------------------------------------------------------------
# Node 5 — final concise answer, aware of the frontend's markdown/table/chart support
# ---------------------------------------------------------------------------
FINAL_SYSTEM_PROMPT = """You are a financial analyst assistant for a crop-trading
business (Karma Trading). Answer using ONLY the data and calculated results
given to you. Be short, direct, and concise — a few sentences unless a table
or chart is clearly the better format.

The frontend renders your reply as Markdown with these capabilities:
- Standard markdown tables ( | col | col | ) render natively — use for
  row-level or comparison data.
- For a chart, use a fenced code block with language "chart" containing
  JSON in EXACTLY this shape:
  ```chart
  {"type": "bar", "xKey": "name", "series": [{"key": "value", "color": "#2563eb"}], "data": [{"name": "Jan", "value": 30}]}
  ```
  "type" can be "bar", "line", or "pie". Only include a chart when it
  genuinely helps (a trend or comparison across multiple items) — never
  for a single number.
- Regular code blocks (other languages) render with syntax highlighting.

Never invent numbers that aren't present in the data below. If the data is
empty or an error occurred, say so plainly and briefly.
"""


def final_analysis_node(state: AgentState) -> dict:
    llm = get_llm(temperature=0.2)
    context = (
        f"User question: {state['user_query']}\n\n"
        f"Raw data (JSON): {state.get('query_result_json', '[]')}\n\n"
        f"Calculated results: {json.dumps(state.get('operations_result') or {}, default=str)}"
    )
    messages = [SystemMessage(content=FINAL_SYSTEM_PROMPT)] + list(state.get("messages", [])) + [
        HumanMessage(content=context)
    ]
    response = llm.invoke(messages)
    answer = response.content.strip()

    return {
        "final_answer": answer,
        "messages": [HumanMessage(content=state["user_query"]), AIMessage(content=answer)],
    }


# ---------------------------------------------------------------------------
# Build + compile the graph once, reused across requests
# ---------------------------------------------------------------------------
def _build_graph():
    workflow = StateGraph(AgentState)
    workflow.add_node("generate_sql", generate_sql_node)
    workflow.add_node("execute_sql", execute_sql_node)
    workflow.add_node("identify_operations", identify_operations_node)
    workflow.add_node("apply_operations", apply_operations_node)
    workflow.add_node("final_analysis", final_analysis_node)

    workflow.set_entry_point("generate_sql")
    workflow.add_edge("generate_sql", "execute_sql")
    workflow.add_edge("execute_sql", "identify_operations")
    workflow.add_edge("identify_operations", "apply_operations")
    workflow.add_edge("apply_operations", "final_analysis")
    workflow.add_edge("final_analysis", END)

    checkpointer = MemorySaver()
    return workflow.compile(checkpointer=checkpointer)


_graph = None


def get_chat_graph():
    global _graph
    if _graph is None:
        _graph = _build_graph()
    return _graph
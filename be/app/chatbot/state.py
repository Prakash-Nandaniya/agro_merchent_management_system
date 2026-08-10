from typing import Annotated, Any, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

MAX_SQL_RETRIES = 2
MAX_CODEGEN_RETRIES = 2


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    user_query: str

    # --- set by classify_intent_node ---
    intent: str  # "greeting" | "off_topic" | "business"
    needs_web_search: bool
    needs_db: bool
    is_report: bool

    # --- web_search_node ---
    web_context: str

    # --- generate_sql_node <-> execute_sql_node retry loop ---
    sql_query: str | None
    sql_error: str | None
    sql_feedback: str | None
    sql_retry_count: int
    raw_rows: list[dict[str, Any]]

    # --- plan_math_node / execute_math_node ---
    math_plan: list[dict[str, Any]]
    math_results: dict[str, Any]

    # --- custom_codegen_node retry loop (LLM-written functions) ---
    pending_custom_ops: list[dict[str, Any]]
    custom_code: str | None
    custom_code_error: str | None
    custom_code_retry_count: int

    final_answer: str
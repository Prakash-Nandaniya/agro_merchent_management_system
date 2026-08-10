import json
import re

from langchain_core.messages import HumanMessage, SystemMessage

from app.chatbot.llmconfig import CLASSIFIER_MODEL, make_llm
from app.chatbot.schemacontext import COMPANY_CONTEXT
from app.chatbot.state import AgentState

_GENERAL_KNOWLEDGE_RE = re.compile(
    r"\b(weather|rain|rainfall|wheat|rice|corn|paddy|truck|bag|capacity|carry|harvest|crop|farming|agriculture|soil|yield|fertilizer|irrigation|market|price|commodity|trade|trading)\b",
    re.IGNORECASE,
)
_COMPANY_DATA_RE = re.compile(
    r"\b(our|my|I|we|Karma Trading|karmatrading|invoice|trade|bill|receipt|account|db|database|company|firm|client|customer|seller|buyer)\b",
    re.IGNORECASE,
)

_classifier_llm = make_llm(CLASSIFIER_MODEL)

_GREETING_RE = re.compile(
    r"^\s*(hi+|hello+|hey+|good\s?(morning|afternoon|evening)|how\s?are\s?you|"
    r"what'?s\s?up|yo|sup)\s*[!.?]*\s*$",
    re.IGNORECASE,
)

CLASSIFY_SYSTEM_PROMPT = f"""{COMPANY_CONTEXT}

You are the router in front of a business assistant for Karma Trading. Classify
the user's message. Respond with ONLY this JSON, no markdown fences:

{{
  "intent": "greeting" | "off_topic" | "business",
  "needs_web_search": true/false,
  "needs_db": true/false,
  "is_report": true/false
}}

Guidance:
- "greeting": pure small talk / pleasantries, nothing to answer.
- "off_topic": clearly unrelated to crops, farming, trading, or this business
  (movies, sports, general news unrelated to agriculture, politics unrelated
  to farm/agri policy, "what's the latest" with no business angle, etc.)
- "business": ANYTHING related to — buying crop from farmers, selling to
  mills/wholesalers, crop/commodity prices, production or yield estimates,
  rainfall/weather as it affects crops, crop safety/quality, agricultural
  government policy or regulation, costs, margins, ROI, trends/forecasts,
  invoices, trades, or a request for a business/firm report or summary.
  When in doubt between off_topic and business, and there's any plausible
  agricultural/trading angle, choose "business".
- needs_web_search: true if answering requires current real-world info this
  system doesn't store (weather/rainfall forecasts, current market news,
  government policy changes, commodity price trends outside our own trades).
- needs_db: true if answering requires our own invoices/trades data.
  A single question can need both (e.g. "how does this week's rain forecast
  affect our wheat trades?").
- is_report: true if the user is asking for a report/summary/overview of the
  firm's performance, trades, invoices, or finances (not a narrow single-fact
  question).
"""


def _fallback_classification() -> dict:
    return {"intent": "business", "needs_web_search": False, "needs_db": True, "is_report": False}


async def classify_intent_node(state: AgentState) -> dict:
    query = state["user_query"].strip()

    if _GREETING_RE.match(query):
        return {
            "intent": "greeting",
            "needs_web_search": False,
            "needs_db": False,
            "is_report": False,
        }

    if _GENERAL_KNOWLEDGE_RE.search(query) and not _COMPANY_DATA_RE.search(query):
        return {
            "intent": "business",
            "needs_web_search": False,
            "needs_db": False,
            "is_report": False,
        }

    response = await _classifier_llm.ainvoke(
        [SystemMessage(content=CLASSIFY_SYSTEM_PROMPT), HumanMessage(content=query)]
    )
    raw = response.content.strip().strip("`")
    if raw.lower().startswith("json"):
        raw = raw[4:].strip()

    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        parsed = _fallback_classification()

    return {
        "intent": parsed.get("intent", "business"),
        "needs_web_search": bool(parsed.get("needs_web_search", False)),
        "needs_db": bool(parsed.get("needs_db", True)),
        "is_report": bool(parsed.get("is_report", False)),
    }


def route_after_classify(state: AgentState) -> str:
    intent = state.get("intent", "business")
    if intent == "greeting":
        return "greeting_response"
    if intent == "off_topic":
        return "off_topic_response"
    if not state.get("needs_db", True) and not state.get("needs_web_search", False):
        return "direct_answer"
    return "business_pipeline"


async def greeting_response_node(state: AgentState) -> dict:
    text = "Hi! I'm the Karma Trading assistant — ask me about crop prices, trades, invoices, production estimates, or firm reports."
    from langchain_core.messages import AIMessage

    return {"final_answer": text, "messages": [AIMessage(content=text)]}


async def off_topic_response_node(state: AgentState) -> dict:
    text = "I'm here for Karma Trading's business only — crop sourcing, trades, invoices, pricing, production, or agri policy. Please ask something on that topic."
    from langchain_core.messages import AIMessage

    return {"final_answer": text, "messages": [AIMessage(content=text)]}
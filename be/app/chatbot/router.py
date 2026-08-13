import json
import logging
import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.chatbot.context import format_conversation_context
from app.chatbot.llmconfig import CLASSIFIER_MODEL, FINAL_ANALYSIS_MODEL, make_llm
from app.chatbot.schemacontext import COMPANY_CONTEXT
from app.chatbot.state import AgentState

logger = logging.getLogger(__name__)

_classifier_llm = make_llm(CLASSIFIER_MODEL)

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
  (movies, sports, general news unrelated to agriculture, etc.)
- "business": ANYTHING related to — buying crop from farmers, selling to
  mills/wholesalers, crop/commodity prices, production or yield estimates,
  rainfall/weather as it affects crops, crop safety/quality, agricultural
  government policy, costs, margins, ROI, trends/forecasts, invoices, trades,
  truck loading amounts, rain season, or firm reports. When in doubt and there's
  any plausible agricultural/trading angle, choose "business".
- needs_web_search: true if answering requires current real-world info this
  system doesn't store (weather/rainfall forecasts, market news, policy changes,
  commodity price trends outside our own trades).
- needs_db: true if answering requires our own invoices/trades data.
- is_report: true if the user wants a report/summary/overview of firm performance.
"""


def _fallback_classification() -> dict:
    return {"intent": "business", "needs_web_search": False, "needs_db": True, "is_report": False}


async def classify_intent_node(state: AgentState) -> dict:
    context = format_conversation_context(state)

    raw = ""
    parsed = None
    try:
        response = await _classifier_llm.ainvoke(
            [SystemMessage(content=CLASSIFY_SYSTEM_PROMPT), HumanMessage(content=context)]
        )
        raw = (response.content or "").strip().strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
        parsed = json.loads(raw)
    except Exception as e:
        # LLM/network failure or JSON parse error — fall back to simple heuristics
        logger.exception("Classifier LLM failed: %s", e)

    if not parsed:
        # Heuristic fallback using keywords
        text = (context or "").lower()
        greeting_re = re.compile(r"^\s*(hi+|hello+|hey+|good\s?(morning|afternoon|evening)|how\s?are\s?you|what'?s\s?up)\b")
        business_keywords = [
            "crop",
            "wheat",
            "rice",
            "corn",
            "paddy",
            "truck",
            "bag",
            "price",
            "market",
            "trade",
            "invoice",
            "harvest",
            "rain",
            "rainfall",
            "forecast",
            "fertilizer",
            "yield",
        ]
        company_keywords = ["our", "my", "we", "karma", "karmatrading", "invoice", "trade", "client", "customer"]

        intent = "business"
        needs_web = False
        needs_db = False
        is_report = False

        if greeting_re.search(text):
            intent = "greeting"
        elif any(k in text for k in company_keywords):
            intent = "business"
            needs_db = True
        elif any(k in text for k in business_keywords):
            intent = "business"
            # weather/price/forecast terms likely need web context
            needs_web = any(w in text for w in ["rain", "rainfall", "forecast", "price", "market"]) 
        else:
            # fallback to off_topic when nothing matches
            intent = "off_topic"

        parsed = {
            "intent": intent,
            "needs_web_search": needs_web,
            "needs_db": needs_db,
            "is_report": is_report,
            "fallback": True,
        }

    return {
        "intent": parsed.get("intent", "business"),
        "needs_web_search": bool(parsed.get("needs_web_search", False)),
        "needs_db": bool(parsed.get("needs_db", True)),
        "is_report": bool(parsed.get("is_report", False)),
        "classification_raw": raw or "(fallback)",
        "classification_result": parsed,
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
    # If this is a genuine greeting, call an LLM with the full conversation
    # context and return its reply. This provides natural, varied salutations.
    try:
        context = format_conversation_context(state)
        llm = make_llm(FINAL_ANALYSIS_MODEL, temperature=0.7)
        sys = SystemMessage(content="You are a friendly assistant. Reply briefly to the user's greeting.")
        hum = HumanMessage(content=context)
        resp = await llm.ainvoke([sys, hum])
        text = (resp.content or "").strip()
        if not text:
            raise ValueError("empty LLM response")
    except Exception:
        # Fallback to canned greeting if LLM fails
        text = (
            "Hi! I'm the Karma Trading assistant — ask me about crop prices, trades, "
            "invoices, production estimates, rainfall forecasts, or firm reports."
        )

    return {"final_answer": text, "output_type": "text", "messages": [AIMessage(content=text)]}


async def off_topic_response_node(state: AgentState) -> dict:
    # For out-of-context questions, respond with the friendly greeting that
    # points users back to Karma Trading topics (same as greeting_response).
    text = (
        "Hi! I'm the Karma Trading assistant — ask me about crop prices, trades, "
        "invoices, production estimates, rainfall forecasts, or firm reports."
    )
    return {"final_answer": text, "output_type": "text", "messages": [AIMessage(content=text)]}

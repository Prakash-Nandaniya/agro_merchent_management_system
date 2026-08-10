import os
import re

import requests
from langchain_core.messages import HumanMessage, SystemMessage

from app.chatbot.llmconfig import SUMMARIZER_MODEL, make_llm
from app.chatbot.state import AgentState

SEARCH_API_KEY = os.getenv("WEB_SEARCH_API_KEY")
_summarizer_llm = make_llm(SUMMARIZER_MODEL)

REQUEST_TIMEOUT = 8
MAX_RESULTS = 3
MAX_FETCH_CHARS = 4000


def _search(query: str, num_results: int = MAX_RESULTS) -> list[dict]:
    if not SEARCH_API_KEY:
        return []
    try:
        params = {
            "api_key": SEARCH_API_KEY,
            "engine": "google",
            "q": query,
            "num": num_results,
            "hl": "en",
        }
        resp = requests.get("https://serpapi.com/search.json", params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        return [
            {"title": item.get("title"), "snippet": item.get("snippet"), "link": item.get("link")}
            for item in data.get("organic_results", [])[:num_results]
            if item.get("link")
        ]
    except Exception:
        return []


def _fetch_readable_text(url: str) -> str:
    try:
        resp = requests.get(
            url,
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": "Mozilla/5.0 (compatible; KarmaTradingBot/1.0)"},
        )
        resp.raise_for_status()
        html = resp.text
    except Exception:
        return ""

    html = re.sub(r"(?is)<(script|style|noscript).*?>.*?(</\1>)", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    text = re.sub(r"&[a-zA-Z#0-9]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_FETCH_CHARS]


SUMMARIZE_SYSTEM_PROMPT = """Summarize the fetched web content into a short,
factual briefing for an agricultural trading business assistant. Keep only
information relevant to the user's question (prices, weather/rainfall,
government policy, market conditions). 4-8 sentences max. Note the source
domain for each fact in parentheses. If a page had no useful content, skip it
silently — do not comment on fetch failures."""


async def web_search_node(state: AgentState) -> dict:
    if not state.get("needs_web_search"):
        return {"web_context": ""}

    results = _search(state["user_query"])
    if not results:
        return {"web_context": ""}

    pages = []
    for r in results:
        text = _fetch_readable_text(r["link"])
        pages.append(
            f"SOURCE: {r['link']}\nTITLE: {r.get('title', '')}\n"
            f"SNIPPET: {r.get('snippet', '')}\nCONTENT: {text or '(fetch failed, snippet only)'}"
        )

    combined = "\n\n---\n\n".join(pages)
    response = await _summarizer_llm.ainvoke(
        [
            SystemMessage(content=SUMMARIZE_SYSTEM_PROMPT),
            HumanMessage(content=f"User question: {state['user_query']}\n\n{combined}"),
        ]
    )
    return {"web_context": response.content.strip()}
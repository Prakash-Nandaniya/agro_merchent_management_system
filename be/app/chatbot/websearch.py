from langchain_core.messages import HumanMessage, SystemMessage

from app.chatbot.context import format_conversation_context
from app.chatbot.llmconfig import SUMMARIZER_MODEL, make_llm
from app.chatbot.state import AgentState

_summarizer_llm = make_llm(SUMMARIZER_MODEL)

WEB_CONTEXT_PROMPT = """You are helping an agricultural trading business assistant.
The user's question needs current real-world information (weather, market prices,
government policy, commodity trends) that is not stored in the company database.

Using your general knowledge, provide a brief factual briefing (4-8 sentences)
relevant to the question. Clearly note this is general knowledge guidance, not
live web data. Focus on crops, trading, rainfall, and agri policy when relevant."""


async def web_search_node(state: AgentState) -> dict:
    if not state.get("needs_web_search"):
        return {"web_context": ""}

    context = format_conversation_context(state)
    response = await _summarizer_llm.ainvoke([
        SystemMessage(content=WEB_CONTEXT_PROMPT),
        HumanMessage(content=context),
    ])
    return {"web_context": (response.content or "").strip()}

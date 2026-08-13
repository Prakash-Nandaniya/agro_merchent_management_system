"""Build full conversation context for every LLM call."""

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.chatbot.state import AgentState


def format_conversation_context(state: AgentState) -> str:
    """Return messages + summary as one string for LLM prompts."""
    lines: list[str] = []
    summary = state.get("conversation_summary", "")
    if summary:
        lines.append(f"Conversation summary:\n{summary}")

    messages = state.get("messages", [])
    if messages:
        for msg in messages:
            if isinstance(msg, SystemMessage):
                if not summary or "Conversation summary" not in (msg.content or ""):
                    lines.append(msg.content or "")
            elif isinstance(msg, AIMessage):
                lines.append(f"Assistant: {msg.content}")
            elif isinstance(msg, HumanMessage):
                lines.append(f"User: {msg.content}")
    elif state.get("user_query"):
        lines.append(state["user_query"])

    return "\n\n".join(line for line in lines if line.strip())

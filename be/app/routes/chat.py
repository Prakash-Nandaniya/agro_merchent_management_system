from fastapi import APIRouter, Depends, Request, Response
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.chatbot.history_store import append_qa_pair, compact_history_if_needed, get_thread, purge_old_threads
from app.chatbot.langgraph import build_graph
from app.database.session import get_agent_db
from app.core.exceptions import NotAuthenticatedException
router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    chat_deleted: bool = False


class ChatResponse(BaseModel):
    answer: str
    output_type: str = "text"


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    request_obj: Request,
    response: Response,
    db: AsyncSession = Depends(get_agent_db),
) -> ChatResponse:
    graph = build_graph(db)

    session_key = request_obj.cookies.get("session_key")
    if not session_key:
        raise NotAuthenticatedException()

    user_message_text = request.message
    # If frontend requested deletion of this chat, delete storage first
    if request.chat_deleted:
        from app.chatbot.history_store import delete_thread

        delete_thread(session_key)

    thread = get_thread(session_key)
    summary = thread.get("summary", "")

    messages = []
    if summary:
        messages.append(SystemMessage(content=f"Conversation summary:\n{summary}"))

    for m in thread.get("full_messages", []):
        if m.get("role") == "assistant":
            messages.append(AIMessage(content=m.get("content")))
        else:
            messages.append(HumanMessage(content=m.get("content")))

    messages.append(HumanMessage(content=user_message_text))

    # attach session_key/thread_id to graph config for the checkpointer/observability
    # langgraph checkpointer expects a 'thread_id' key in configurable
    config = {"configurable": {"session_key": session_key, "thread_id": session_key}}

    result = await graph.ainvoke(
        {
            "messages": messages,
            "user_query": user_message_text,
            "sql_retry_count": 0,
            "custom_code_retry_count": 0,
            "conversation_summary": summary,
            "qa_count": thread.get("qa_count", 0),
        },
        config=config,
    )

    final_text = result.get("final_answer") or "Sorry, I couldn't produce an answer for that."
    output_type = result.get("output_type", "text")

    append_qa_pair(session_key, user_message_text, final_text)
    await compact_history_if_needed(session_key)

    return ChatResponse(answer=final_text, output_type=output_type)

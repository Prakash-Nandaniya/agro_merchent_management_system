from fastapi import APIRouter, Body, Depends
from fastapi.responses import PlainTextResponse
from langchain_core.messages import HumanMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.chatbot.langgraph import build_graph
from app.database.session import get_agent_db

from pydantic import BaseModel 

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    answer: str
    
@router.post("/chat/{thread_id}", response_model=ChatResponse)
async def chat(
    thread_id: str,
    request: ChatRequest,  
    db: AsyncSession = Depends(get_agent_db),
) -> ChatResponse:
    graph = build_graph(db)
    config = {"configurable": {"thread_id": thread_id}}

    user_message_text = request.message

    result = await graph.ainvoke(
        {
            "messages": [HumanMessage(content=user_message_text)],
            "user_query": user_message_text,  
            "sql_retry_count": 0,
            "custom_code_retry_count": 0,
        },
        config=config,
    )

    final_text = result.get("final_answer") or "Sorry, I couldn't produce an answer for that."
    
    return ChatResponse(answer=final_text)
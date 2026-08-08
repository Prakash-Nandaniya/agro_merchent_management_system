from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.chatbot.langgraph import get_chat_graph
from app.database.session import get_agent_db 

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    answer: str


@router.post("/chat/{thread_id}", response_model=ChatResponse)
async def chat_endpoint(
    thread_id: str,
    payload: ChatRequest,
    db: Session = Depends(get_agent_db),
):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    graph = get_chat_graph()
    config = {
        "configurable": {
            "thread_id": thread_id, 
            "db_session": db,
        }
    }

    try:
        result = graph.invoke(
            {"user_query": payload.message, "messages": []},
            config=config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent failed: {e}")

    answer = result.get("final_answer") or "Sorry, I couldn't generate a response."
    return ChatResponse(answer=answer)
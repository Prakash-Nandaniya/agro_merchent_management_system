from sqlalchemy.orm import sessionmaker
from .engine import engine, ai_agent_engine

SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine
)

AgentSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=ai_agent_engine
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_agent_db():
    db = AgentSessionLocal()
    try:
        yield db
    finally:
        db.close()
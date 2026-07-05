from sqlalchemy.orm import sessionmaker
from .engine import engine

SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine
)

# Dependency function to get the database session in your routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
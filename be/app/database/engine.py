from sqlalchemy import create_engine
from app.core.config import settings

engine = create_engine(
    str(settings.DATABASE_URL),
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={
        "connect_timeout": 5,       
        "keepalives": 1,
        "keepalives_idle": 15,      
        "keepalives_interval": 5,   
        "keepalives_count": 3,      
    },
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database.models.mill import Base
from datetime import datetime
from sqlalchemy.sql import func 
from sqlalchemy import DateTime


class ProfileConfiguration(Base):
    __tablename__ = "profile_configuration"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )
    
    configuration: Mapped[dict] = mapped_column(JSONB, nullable=False, default={})
    

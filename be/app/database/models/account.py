import uuid
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base  # Make sure your Base import is correct
from datetime import datetime
from sqlalchemy.sql import func
from sqlalchemy import DateTime, String
from typing import List


class Account(Base):
    __tablename__ = "account"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String, nullable=False)
    configuration: Mapped[dict] = mapped_column(JSONB, nullable=False, default={})
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    last_millbill_invoiceNo:Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    
    def __repr__(self) -> str:
        return f"<UserName(id={self.user_name})>"

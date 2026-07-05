from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database.models.mill import Base


class ProfileConfiguration(Base):
    __tablename__ = "profile_configuration"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    configuration: Mapped[dict] = mapped_column(JSONB, nullable=False, default={})

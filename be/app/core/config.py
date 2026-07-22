from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import PostgresDsn


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: PostgresDsn
    SECRET_KEY: str
    MAX_SESSION_AGE_IN_SECONDS: int
    ALGORITHM: str
    FE_URL: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_BUCKET_NAME: str
    R2_ENDPOINT: str


settings = Settings()
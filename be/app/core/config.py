from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import PostgresDsn


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database URL
    DATABASE_URL: PostgresDsn


# We create a single instance of this class to be imported everywhere else
settings = Settings()

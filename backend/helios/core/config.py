"""Unica fuente de configuracion del backend."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuracion leida de variables de entorno con prefijo HELIOS_."""

    model_config = SettingsConfigDict(
        env_prefix="HELIOS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    backend_port: int = 8723
    log_level: str = "INFO"

    llm_provider: str = "none"
    llm_base_url: str = "http://127.0.0.1:11434"
    llm_model: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()

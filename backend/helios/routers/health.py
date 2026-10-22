"""Estado del backend y del proveedor de IA."""

from fastapi import APIRouter

from helios import __version__
from helios.core.config import get_settings

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "version": __version__,
        "backend": "online",
        "provider": settings.llm_provider,
    }

"""Aplicacion FastAPI del sidecar HELIOS."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from helios import __version__
from helios.core.config import get_settings
from helios.routers import health


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="HELIOS",
        version=__version__,
        description="Backend local del asistente de escritorio HELIOS.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:*", "http://localhost:*", "file://*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)

    return app


def main() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "helios.main:create_app",
        factory=True,
        host=settings.host,
        port=settings.backend_port,
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()

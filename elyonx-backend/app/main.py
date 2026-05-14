import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.endpoints import audio, rta, devices, health, mixer, settings as runtime_settings
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.routes.auth import router as auth_router
from app.services.audio_engine import AudioEngine
from app.services.ims_inference import ims_service
from app.services.x32_osc import X32OscService

# Logging
setup_logging()
logger = logging.getLogger("elyonx.main")

# Shared audio engine instance (singleton)
audio_engine = AudioEngine()
mixer_service = X32OscService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    logger.info("ElyonX backend starting up…")
    # Store engine in app state for access in endpoints
    app.state.audio_engine = audio_engine
    app.state.mixer_service = mixer_service
    
    # Load IMS model (non-blocking if it fails, just logs a warning)
    ims_service.load()
    app.state.ims_model = ims_service
    
    yield
    # Graceful shutdown
    logger.info("ElyonX backend shutting down…")
    await audio_engine.stop()
    await mixer_service.disconnect()
    
# App factory
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Real-time intelligent mixing system backend for ElyonX",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        lifespan=lifespan,
    )

    # Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Routers
    app.include_router(auth_router)  # /auth/*
    app.include_router(health.router,   prefix="/api/v1",        tags=["Health"])
    app.include_router(devices.router,  prefix="/api/v1/devices", tags=["Devices"])
    app.include_router(audio.router,    prefix="/api/v1/audio",   tags=["Audio"])
    app.include_router(rta.router,      prefix="/api/v1/rta",     tags=["RTA"])
    app.include_router(mixer.router,    prefix="/api/v1/mixer",   tags=["Mixer"])
    app.include_router(runtime_settings.router, prefix="/api/v1/settings", tags=["Settings"])

    return app

app = create_app()

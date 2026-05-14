from fastapi import APIRouter, Request
from app.schemas.audio import HealthResponse
from app.core.config import settings
from app.core.ws_manager import ws_manager

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="System health check")
async def health(request: Request) -> HealthResponse:
    engine = request.app.state.audio_engine
    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        stream_active=engine.is_running,
        ws_clients=ws_manager.active_connections,
    )
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.cache import setup_fastf1_cache
from app.core.logging import setup_logging
from app.api.routes import router as api_router
from app.api.history import router as history_router
from app.services.live_service import start_live_service, stop_live_service

setup_logging()
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ApexF1 Backend starting up...")
    setup_fastf1_cache()
    start_live_service()   # start OpenF1 live broadcaster
    yield
    stop_live_service()
    logger.info("ApexF1 Backend shutting down...")


app = FastAPI(
    title="ApexF1 API",
    description="Formula 1 Real-Time Analytics Platform",
    version="2.0.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(api_router, prefix="/api")
app.include_router(history_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ApexF1 API v2", "version": "2.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"success": False, "error": "The service could not complete this request."})

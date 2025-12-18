import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .config import settings
from .redis_client import RedisClient
from .routers import analysis, feedback

# Configure Loguru
logger.remove()
logger.add(
    sys.stdout,
    colorize=True,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level=settings.LOG_LEVEL.upper(),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Faultline AI API...", app.title)
    await RedisClient.connect()
    yield
    logger.info("Shutting down Faultline AI API...")
    await RedisClient.disconnect()


app = FastAPI(title="Faultline AI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Change in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router, tags=["analysis"])
app.include_router(feedback.router, tags=["feedback"])


@app.get("/health")
async def health_check():
    """
    Load balancers like lies that look like truths.
    """
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {"message": "Faultline AI API"}

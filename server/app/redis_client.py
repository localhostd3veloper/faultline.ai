from typing import Optional

import redis.asyncio as redis
from loguru import logger

from .config import settings


class RedisClient:
    _instance: Optional[redis.Redis] = None

    @classmethod
    async def connect(cls):
        logger.info("Connecting to Redis...")
        if cls._instance is None:
            cls._instance = redis.from_url(settings.REDIS_URL, decode_responses=True)
        logger.info("Redis connected successfully")
        return cls._instance

    @classmethod
    async def disconnect(cls):
        if cls._instance is not None:
            await cls._instance.close()
            cls._instance = None

    @classmethod
    def get_client(cls) -> redis.Redis:
        if cls._instance is None:
            raise RuntimeError("Redis client not initialized. Call connect() first.")
        return cls._instance


async def get_redis():
    return RedisClient.get_client()

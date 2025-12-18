from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    REDIS_URL: str = "redis://localhost:6379/0"
    JOB_KEY_PREFIX: str = "job:"
    JOB_EXPIRATION: int = 3600
    OPENAI_API_KEY: str = "sk-..."
    LOG_LEVEL: str = "INFO"

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

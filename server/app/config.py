from typing import Literal, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    REDIS_URL: str = "redis://localhost:6379/0"
    JOB_KEY_PREFIX: str = "job:"
    CACHE_KEY_PREFIX: str = "cache:"
    JOB_EXPIRATION: int = 3600
    CACHE_EXPIRATION: int = 86400  # 24 hours

    # AI Configuration
    AI_PROVIDER: Literal["openai", "google", "groq", "ollama"] = "ollama"
    AI_MODEL: str = "llama3.1"

    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: str = "http://localhost:11434/v1"

    # Artifact Constraints
    MAX_CONTENT_SIZE: int = 500_000  # ~500 KB
    MAX_ENDPOINTS: int = 100
    MAX_COMPONENTS: int = 50
    MAX_SECTIONS: int = 50

    # AI Runtime Constraints
    MAX_AI_TOKENS: int = 4096
    AI_TEMPERATURE: float = 0.2

    LOG_LEVEL: str = "INFO"

    def get_model(self):
        """Returns the configured Pydantic AI model."""
        match self.AI_PROVIDER:
            case "openai":
                from pydantic_ai.models.openai import OpenAIChatModel
                from pydantic_ai.providers.openai import OpenAIProvider

                return OpenAIChatModel(
                    self.AI_MODEL, provider=OpenAIProvider(api_key=self.OPENAI_API_KEY)
                )

            case "google":
                from pydantic_ai.models.google import GoogleModel
                from pydantic_ai.providers.google import GoogleProvider

                return GoogleModel(
                    self.AI_MODEL, provider=GoogleProvider(api_key=self.GEMINI_API_KEY)
                )

            case "groq":
                from pydantic_ai.models.groq import GroqModel
                from pydantic_ai.providers.groq import GroqProvider

                return GroqModel(
                    self.AI_MODEL, provider=GroqProvider(api_key=self.GROQ_API_KEY)
                )

            case "ollama":
                from pydantic_ai.models.openai import OpenAIChatModel
                from pydantic_ai.providers.ollama import OllamaProvider

                return OpenAIChatModel(
                    self.AI_MODEL,
                    provider=OllamaProvider(base_url=self.OLLAMA_BASE_URL),
                )

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

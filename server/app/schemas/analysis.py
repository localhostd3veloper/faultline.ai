from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ContentType(str, Enum):
    MARKDOWN = "markdown"
    OPENAPI_YAML = "openapi-yaml"
    OPENAPI_JSON = "openapi-json"

class AnalysisMetadata(BaseModel):
    repo: Optional[str] = None
    team: Optional[str] = None
    risk_tolerance: Optional[str] = Field(None, alias="riskTolerance")
    depth: Optional[str] = None

    class Config:
        populate_by_name = True

class AnalysisRequest(BaseModel):
    content: str
    content_type: ContentType = Field(alias="contentType")
    metadata: Optional[AnalysisMetadata] = Field(default_factory=AnalysisMetadata)

    class Config:
        populate_by_name = True

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress_hints: Optional[str] = None

class AnalysisResult(BaseModel):
    job_id: str
    status: JobStatus
    result: Optional[Dict[str, Any]] = None
    markdown: Optional[str] = None


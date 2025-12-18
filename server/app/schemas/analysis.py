from enum import Enum
from typing import Optional

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


class Finding(BaseModel):
    title: str
    description: str
    category: str
    severity: str
    rationale: str
    remediation: str


class AnalysisData(BaseModel):
    production_readiness_score: int
    summary: str
    findings: list[Finding]
    suggested_next_steps: list[str]


class AnalysisResult(BaseModel):
    job_id: str
    status: JobStatus
    result: Optional[AnalysisData] = None
    markdown: Optional[str] = None

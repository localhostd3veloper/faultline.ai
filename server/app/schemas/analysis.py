from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Severity(str, Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class ContentType(str, Enum):
    MARKDOWN = "markdown"
    OPENAPI_YAML = "openapi-yaml"
    OPENAPI_JSON = "openapi-json"
    ARCHITECTURE = "architecture"


class Endpoint(BaseModel):
    path: str
    method: str
    secured: bool = True
    has_pagination: bool = False
    has_versioning: bool = False


class Component(BaseModel):
    name: str
    type: str  # e.g., 'service', 'database', 'queue'
    description: Optional[str] = None


class NormalizedArtifact(BaseModel):
    kind: str
    services: list[str] = Field(default_factory=list)
    endpoints: Optional[list[Endpoint]] = None
    components: Optional[list[Component]] = None
    raw_sections: dict[str, str] = Field(default_factory=dict)


class HeuristicFinding(BaseModel):
    title: str
    description: str
    category: str
    severity: Severity
    confidence: Literal["high", "medium", "low"]
    source: Literal["openapi", "architecture", "documentation"]
    rationale: str
    remediation: str


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
    progress_hint: Optional[str] = None


class Finding(BaseModel):
    title: str
    description: str
    category: str
    severity: str
    rationale: str
    remediation: str


class ChartDataPoint(BaseModel):
    label: str
    value: float


class Chart(BaseModel):
    title: str
    type: str  # 'line', 'bar', 'pie'
    description: str
    data: list[ChartDataPoint]


class AnalysisData(BaseModel):
    production_readiness_score: int
    summary: str
    findings: list[Finding] = Field(default_factory=list)
    charts: list[Chart] = Field(default_factory=list)
    suggested_next_steps: list[str] = Field(default_factory=list)
    markdown_report: str = Field(default="", alias="markdownReport")

    class Config:
        populate_by_name = True


class AnalysisResult(BaseModel):
    job_id: str
    status: JobStatus
    result: Optional[AnalysisData] = None
    markdown: Optional[str] = None


class AgentInput(BaseModel):
    normalized_artifact: NormalizedArtifact
    heuristic_findings: list[HeuristicFinding]
    metadata: AnalysisMetadata

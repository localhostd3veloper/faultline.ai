import asyncio
import hashlib
import json
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, HTTPException
from loguru import logger
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from ..config import settings
from ..redis_client import get_redis
from ..schemas.analysis import AnalysisRequest, AnalysisResult, JobResponse, JobStatus

router = APIRouter()


class Finding(BaseModel):
    title: str
    description: str
    category: str
    severity: str
    rationale: str
    remediation: str


class AnalysisOutput(BaseModel):
    production_readiness_score: int
    summary: str
    findings: List[Finding]
    suggested_next_steps: List[str]
    markdown_report: str


analysis_agent = Agent(
    model=OpenAIChatModel(
        "gpt-4o", provider=OpenAIProvider(api_key=settings.OPENAI_API_KEY)
    ),
    output_type=AnalysisOutput,
    system_prompt=(
        "You are a production-grade software architecture and security expert. "
        "Analyze the provided artifact (code, config, or architecture) and identify 3-6 meaningful findings. "
        "Categorize findings into groups like Scalability, AI Risk, Cloud, Security, Reliability, etc. "
        "Assign severity levels: High, Medium, or Low. "
        "Provide a Production Readiness Score (0-100), rationale for each finding, "
        "and actionable remediation guidance."
    ),
)


def compute_content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def run_analysis_task(
    job_id: str, content: str, content_type: str, metadata: Dict[str, Any]
):
    redis = await get_redis()
    job_key = f"{settings.JOB_KEY_PREFIX}{job_id}"

    async def update_job(
        status: JobStatus,
        progress: str = None,
        result: dict = None,
        markdown: str = None,
    ):
        job_data = await redis.get(job_key)
        if job_data:
            data = json.loads(job_data)
            data["status"] = status
            if progress:
                data["progress_hints"] = progress
            if result:
                data["result"] = result
            if markdown:
                data["markdown"] = markdown
            await redis.set(job_key, json.dumps(data), ex=settings.JOB_EXPIRATION)

    try:
        logger.info(f"Job {job_id}: Starting analysis for {content_type}")
        await update_job(JobStatus.RUNNING, "Initializing analysis engine...")
        await asyncio.sleep(5)

        logger.debug(f"Job {job_id}: Analyzing content...")
        await update_job(JobStatus.RUNNING, f"Analyzing {content_type} content...")

        # In a real scenario, we would call the agent:
        # result = await analysis_agent.run(content)
        # analysis_data = result.data

        # Mocking the AI response with the new strict model structure
        analysis_data = AnalysisOutput(
            production_readiness_score=65,
            summary="The artifact shows several production-readiness gaps in security and reliability.",
            findings=[
                Finding(
                    title="SQL Injection Risk",
                    description="Potential unparameterized query in user input.",
                    category="Security",
                    severity="High",
                    rationale="Direct string interpolation in SQL queries allows attackers to execute arbitrary commands.",
                    remediation="Use prepared statements or an ORM with parameterized queries.",
                ),
                Finding(
                    title="Hardcoded Secret",
                    description="AWS API key found in configuration file.",
                    category="Security",
                    severity="High",
                    rationale="Exposing secrets in code leads to unauthorized resource access and potential data breaches.",
                    remediation="Move secrets to environment variables or a secret management service like AWS Secrets Manager.",
                ),
                Finding(
                    title="Missing Health Check",
                    description="The service lacks a dedicated health check endpoint.",
                    category="Reliability",
                    severity="Medium",
                    rationale="Orchestrators cannot determine if the service is healthy or needs a restart without a probe.",
                    remediation="Implement a /health endpoint that checks database and cache connectivity.",
                ),
            ],
            suggested_next_steps=[
                "Implement environment-based secret management.",
                "Add automated SQL injection scanning to the CI/CD pipeline.",
                "Configure liveness and readiness probes in deployment manifests.",
            ],
            markdown_report="### Analysis Result\nFound 3 findings during scan.",
        )

        logger.info(
            f"Job {job_id}: Analysis complete with {len(analysis_data.findings)} findings"
        )
        await update_job(
            JobStatus.COMPLETED,
            "Analysis complete",
            result=analysis_data.model_dump(exclude={"markdown_report"}),
            markdown=analysis_data.markdown_report,
        )

    except Exception as e:
        logger.exception(f"Job {job_id}: Analysis failed")
        await update_job(JobStatus.FAILED, progress=f"Error: {str(e)}")
    finally:
        # Note: redis closing is handled by lifespan, but we should not close the shared client here
        pass


@router.post("/artifacts/analyze", response_model=JobResponse)
async def analyze_artifact(request: AnalysisRequest, background_tasks: BackgroundTasks):
    content_hash = compute_content_hash(request.content)
    job_id = str(uuid.uuid4())
    job_key = f"{settings.JOB_KEY_PREFIX}{job_id}"

    job_info = {
        "job_id": job_id,
        "status": JobStatus.QUEUED,
        "content_hash": content_hash,
        "metadata": request.metadata.model_dump() if request.metadata else {},
        "progress_hints": "Job queued",
    }

    redis = await get_redis()
    await redis.set(job_key, json.dumps(job_info), ex=settings.JOB_EXPIRATION)

    logger.info(f"Job {job_id} queued for content type: {request.content_type}")
    background_tasks.add_task(
        run_analysis_task,
        job_id,
        request.content,
        request.content_type,
        request.metadata.model_dump() if request.metadata else {},
    )

    return JobResponse(
        job_id=job_id, status=JobStatus.QUEUED, progress_hints="Job queued"
    )


@router.post("/analyze", response_model=JobResponse, include_in_schema=False)
async def analyze_artifact_alias(
    request: AnalysisRequest, background_tasks: BackgroundTasks
):
    return await analyze_artifact(request, background_tasks)


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str):
    redis = await get_redis()
    job_key = f"{settings.JOB_KEY_PREFIX}{job_id}"
    job_data = await redis.get(job_key)

    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")

    data = json.loads(job_data)
    return JobResponse(
        job_id=job_id,
        status=data["status"],
        progress_hints=data.get("progress_hints"),
    )


@router.get("/jobs/{job_id}/result", response_model=AnalysisResult)
async def get_job_result(job_id: str):
    redis = await get_redis()
    job_key = f"{settings.JOB_KEY_PREFIX}{job_id}"
    job_data = await redis.get(job_key)

    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")

    data = json.loads(job_data)
    if data["status"] != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed. Current status: {data['status']}",
        )

    return AnalysisResult(
        job_id=job_id,
        status=data["status"],
        result=data.get("result"),
        markdown=data.get("markdown"),
    )

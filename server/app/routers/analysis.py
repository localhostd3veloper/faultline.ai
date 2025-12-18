import hashlib
import json
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, HTTPException
from loguru import logger
from pydantic import BaseModel
from pydantic_ai import Agent, ModelSettings, RunContext

from ..config import settings
from ..logic.analysis import normalize_artifact, run_heuristics
from ..redis_client import get_redis
from ..schemas.analysis import (
    AnalysisData,
    AnalysisMetadata,
    AnalysisRequest,
    AnalysisResult,
    HeuristicFinding,
    JobResponse,
    JobStatus,
    NormalizedArtifact,
)

router = APIRouter()


class AgentInput(BaseModel):
    normalized_artifact: NormalizedArtifact
    heuristic_findings: List[HeuristicFinding]
    metadata: AnalysisMetadata


analysis_agent = Agent(
    model=settings.get_model(),
    output_type=AnalysisData,
    deps_type=AgentInput,
    retries=3,
)


@analysis_agent.system_prompt
def get_system_prompt(ctx: RunContext[AgentInput]) -> str:
    return (
        "You are an expert software architect. Review the provided artifact and findings. "
        "Each heuristic finding includes a 'confidence' level (low/medium/high) and a 'source'. "
        "Use this metadata to weigh the findings: trust 'high' confidence facts from OpenAPI more than 'low' confidence documentation signals. "
        "1. Prioritize findings and add missing ones. "
        "2. Provide remediation for each. "
        "3. Generate a score (0-100) and summary. "
        "4. Create data for 3 charts (pie, bar, or line). "
        "\n\nSTRICT JSON RULES: "
        "- No trailing commas. "
        "- production_readiness_score must be an integer. "
        "- markdown_report must be valid markdown. "
        f"\n\nARTIFACT DATA TO ANALYZE:\n{ctx.deps.model_dump_json()}"
    )


def compute_content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def run_analysis_task(
    job_id: str,
    content: str,
    content_type: str,
    metadata: Dict[str, Any],
    content_hash: str,
):
    redis = await get_redis()
    job_key = f"{settings.JOB_KEY_PREFIX}{job_id}"
    cache_key = f"{settings.CACHE_KEY_PREFIX}{content_hash}"

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
                data["progress_hint"] = progress
            if result:
                data["result"] = result
            if markdown:
                data["markdown"] = markdown
            await redis.set(job_key, json.dumps(data), ex=settings.JOB_EXPIRATION)

    try:
        logger.info(f"Job {job_id}: Starting analysis for {content_type}")
        await update_job(JobStatus.RUNNING, "Normalizing artifact...")

        # Step 0: SIZE GUARDRAIL
        if len(content) > settings.MAX_CONTENT_SIZE:
            raise ValueError(
                f"Artifact size ({len(content)} bytes) exceeds maximum limit of {settings.MAX_CONTENT_SIZE} bytes"
            )

        # Step 1: NORMALIZE
        normalized = normalize_artifact(content, content_type)
        logger.debug(f"Job {job_id}: Normalized into {normalized.kind}")

        # Step 2: HEURISTICS
        await update_job(JobStatus.RUNNING, "Running heuristics...")
        heuristic_findings = run_heuristics(normalized)
        logger.debug(
            f"Job {job_id}: Found {len(heuristic_findings)} heuristic findings"
        )

        # Step 3: AI SYNTHESIS
        await update_job(JobStatus.RUNNING, "Synthesizing with AI...")
        agent_input = AgentInput(
            normalized_artifact=normalized,
            heuristic_findings=heuristic_findings,
            metadata=AnalysisMetadata(**metadata),
        )
        logger.debug(
            f"Job {job_id}: Agent input prepared with {len(heuristic_findings)} findings"
        )

        # Use result_retry to handle malformed JSON from local models (like Ollama/Llama)
        # We pass the object directly as deps and let the agent handle it in system_prompt
        result = await analysis_agent.run(
            "Begin synthesis based on provided artifact data.",
            deps=agent_input,
            model_settings=ModelSettings(
                max_tokens=settings.MAX_AI_TOKENS, temperature=settings.AI_TEMPERATURE
            ),
        )
        analysis_data = result.data

        # Log usage and cost metrics
        usage = result.usage()
        logger.info(
            f"Job {job_id}: AI Synthesis complete. "
            f"Model: {settings.AI_MODEL}, "
            f"Tokens: {usage.request_tokens} (prompt) / {usage.response_tokens} (completion) / {usage.total_tokens} (total)"
        )

        logger.info(
            f"Job {job_id}: Analysis complete with {len(analysis_data.findings)} findings"
        )
        result_payload = analysis_data.model_dump(exclude={"markdown_report"})
        await update_job(
            JobStatus.COMPLETED,
            "Analysis complete",
            result=result_payload,
            markdown=analysis_data.markdown_report,
        )

        # Cache the result
        cache_data = {
            "result": result_payload,
            "markdown": analysis_data.markdown_report,
        }
        await redis.set(cache_key, json.dumps(cache_data), ex=settings.CACHE_EXPIRATION)
        logger.info(f"Job {job_id}: Result cached with hash {content_hash}")

    except Exception as e:
        logger.exception(f"Job {job_id}: Analysis failed")
        await update_job(JobStatus.FAILED, progress=f"Error: {str(e)}")
    finally:
        # Note: redis closing is handled by lifespan, but we should not close the shared client here
        pass


@router.post("/artifacts/analyze", response_model=JobResponse)
async def analyze_artifact(request: AnalysisRequest, background_tasks: BackgroundTasks):
    content_hash = compute_content_hash(request.content)
    redis = await get_redis()

    # Check cache
    cache_key = f"{settings.CACHE_KEY_PREFIX}{content_hash}"
    cached_result = await redis.get(cache_key)

    job_id = str(uuid.uuid4())
    job_key = f"{settings.JOB_KEY_PREFIX}{job_id}"

    if cached_result:
        logger.info(f"Cache hit for hash: {content_hash}. Returning cached job.")
        cache_data = json.loads(cached_result)
        job_info = {
            "job_id": job_id,
            "status": JobStatus.COMPLETED,
            "content_hash": content_hash,
            "metadata": request.metadata.model_dump() if request.metadata else {},
            "progress_hint": "Analysis retrieved from cache",
            "result": cache_data["result"],
            "markdown": cache_data["markdown"],
        }
        await redis.set(job_key, json.dumps(job_info), ex=settings.JOB_EXPIRATION)
        return JobResponse(
            job_id=job_id,
            status=JobStatus.COMPLETED,
            progress_hint="Analysis retrieved from cache",
        )

    job_info = {
        "job_id": job_id,
        "status": JobStatus.QUEUED,
        "content_hash": content_hash,
        "metadata": request.metadata.model_dump() if request.metadata else {},
        "progress_hint": "Job queued",
    }

    await redis.set(job_key, json.dumps(job_info), ex=settings.JOB_EXPIRATION)

    logger.info(f"Job {job_id} queued for content type: {request.content_type}")
    background_tasks.add_task(
        run_analysis_task,
        job_id,
        request.content,
        request.content_type,
        request.metadata.model_dump() if request.metadata else {},
        content_hash,
    )

    return JobResponse(
        job_id=job_id, status=JobStatus.QUEUED, progress_hint="Job queued"
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
        progress_hint=data.get("progress_hint"),
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

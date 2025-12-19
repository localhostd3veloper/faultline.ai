import hashlib
import json
import time
import uuid
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException
from loguru import logger
from pydantic_ai import Agent, ModelSettings, RunContext

from ..config import settings
from ..logic.analysis import normalize_artifact, run_heuristics
from ..logic.demo import demo
from ..redis_client import get_redis
from ..schemas.analysis import (
    AgentInput,
    AnalysisData,
    AnalysisMetadata,
    AnalysisRequest,
    AnalysisResult,
    ContentType,
    JobListItem,
    JobListResponse,
    JobResponse,
    JobStatus,
)

router = APIRouter()


if settings.DEMO_MODE:
    analysis_agent = demo
else:
    analysis_agent = Agent(
        model=settings.get_model(),
        output_type=AnalysisData,
        deps_type=AgentInput,
        retries=3,
        output_retries=3,
        model_settings=ModelSettings(
            max_tokens=settings.MAX_AI_TOKENS,
            temperature=settings.AI_TEMPERATURE,
        ),
    )


if not settings.DEMO_MODE:

    @analysis_agent.system_prompt # type: ignore
    def get_system_prompt(ctx: RunContext[AgentInput]) -> str:
        return (
            "You are an expert software architect performing a production-readiness review.\n\n"
            "You are given:\n"
            "- A normalized engineering artifact\n"
            "- A list of heuristic findings\n"
            "- Each heuristic includes a severity, confidence (low/medium/high), and source\n\n"
            "INTERPRETATION RULES:\n"
            "- Treat high-confidence findings from OpenAPI as factual.\n"
            "- Treat medium-confidence findings as likely but uncertain.\n"
            "- Treat low-confidence findings as weak signals; do not overemphasize them.\n"
            "- You may add additional findings ONLY if they are directly implied by the artifact.\n"
            "- Do NOT invent technologies, services, or failures not present in the data.\n\n"
            "TASKS:\n"
            "1. Prioritize all findings by real-world production risk.\n"
            "2. For each finding, provide a concise, actionable remediation.\n"
            "3. Compute a production_readiness_score (0–100) based on severity and breadth of issues.\n"
            "4. Write a clear executive summary explaining what will break first and why.\n"
            "5. Generate exactly three charts with meaningful data:\n"
            "   - One chart must summarize findings by severity.\n"
            "   - One chart must relate to scalability, reliability, or security risk.\n"
            "   - One chart must represent system cost, complexity, or operational risk.\n\n"
            "OUTPUT RULES (STRICT):\n"
            "- Output ONLY a raw JSON object matching the response schema.\n"
            "- Do NOT use function calls, tool calls, or wrappers like 'final_result' or 'parameters'.\n"
            "- The top-level keys in your JSON MUST be: 'production_readiness_score', 'summary', 'findings', 'charts', 'suggested_next_steps', and 'markdown_report'.\n"
            "- Do NOT stringify nested arrays or objects; they must be actual JSON arrays/objects.\n"
            "- Do NOT include explanations, comments, or text outside JSON.\n"
            "- production_readiness_score must be an integer.\n"
            "- markdown_report must be valid markdown.\n"
            "- Charts must contain realistic, internally consistent values.\n\n"
            "DO NOT OUTPUT ANYTHING OTHER THAN THE JSON OBJECT. IT SHOULD NOT BE ENCLOSD IN A CODE BLOCK. DO NOT OUTPUT ANYTHING ELSE."
            "EXAMPLE OF CORRECT TOP-LEVEL STRUCTURE:\n"
            "{\n"
            '  "production_readiness_score": 85,\n'
            '  "summary": "...",\n'
            '  "findings": [],\n'
            '  "charts": [],\n'
            '  "suggested_next_steps": [],\n'
            '  "markdown_report": "# Report..."\n'
            "}\n\n"
            "BEGIN INPUT DATA (READ-ONLY):\n"
            "```json\n"
            f"{ctx.deps.model_dump_json()}\n"
            "```\n\n"
            "END INPUT DATA"
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
        progress: str | None = None,
        result: dict | None = None,
        markdown: str | None = None,
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
        normalized = normalize_artifact(content, ContentType(content_type))
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
        result = await analysis_agent.run(
            "Begin synthesis based on provided artifact data.",
            deps=agent_input,
        )
        analysis_data = result.output

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


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs():
    redis = await get_redis()
    job_pattern = f"{settings.JOB_KEY_PREFIX}*"

    job_keys = []
    async for key in redis.scan_iter(match=job_pattern):
        job_keys.append(key)

    jobs = []
    current_time_ms = int(time.time() * 1000)
    for job_key in job_keys:
        job_data = await redis.get(job_key)
        if job_data:
            job_id = job_key.replace(settings.JOB_KEY_PREFIX, "")
            try:
                data = json.loads(job_data)
                ttl = await redis.ttl(job_key)
                created_at = None
                if ttl > 0:
                    elapsed_seconds = settings.JOB_EXPIRATION - ttl
                    created_at = current_time_ms - (elapsed_seconds * 1000)

                jobs.append(
                    JobListItem(
                        job_id=job_id,
                        status=data.get("status", JobStatus.QUEUED),
                        progress_hint=data.get("progress_hint"),
                        created_at=created_at,
                    )
                )
            except (json.JSONDecodeError, KeyError):
                logger.exception(f"Job {job_id} data is invalid")
                continue

    jobs.sort(key=lambda x: x.created_at or 0, reverse=True)

    return JobListResponse(
        jobs=jobs,
        total=len(jobs),
        note="Runs older than 60 minutes are automatically cleared from the server.",
    )

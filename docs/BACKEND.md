# Backend Documentation

## Technology Stack

- **Framework**: FastAPI 0.112.1+
- **Language**: Python 3.12+
- **Package Manager**: UV
- **AI Integration**: Pydantic AI 1.35.0+
- **Cache/State**: Redis 7.1.0+
- **Logging**: Loguru 0.7.3+
- **Validation**: Pydantic Settings 2.12.0+
- **Server**: Uvicorn (via FastAPI)

## Project Structure

```
server/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Configuration management
│   ├── redis_client.py      # Redis connection singleton
│   ├── routers/
│   │   ├── analysis.py      # Analysis endpoints
│   │   └── feedback.py      # Feedback endpoint (stub)
│   ├── logic/
│   │   ├── analysis.py      # Normalization & heuristics
│   │   └── demo.py          # Demo mode agent
│   └── schemas/
│       ├── analysis.py      # Pydantic models
│       └── feedback.py      # Feedback models
├── Dockerfile
├── pyproject.toml           # Project dependencies
├── uv.lock                   # Locked dependencies
└── README.md
```

## Application Entry Point

### `app/main.py`

**FastAPI Application:**
- Title: "Faultline AI API"
- Lifespan context manager for startup/shutdown
- CORS middleware (currently permissive)
- Router registration
- Health check endpoint

**Lifespan Events:**
- Startup: Connect to Redis
- Shutdown: Disconnect from Redis

**Logging:**
- Loguru configured with colorized output
- Format: timestamp | level | location | message
- Log level from settings

## Configuration

### `app/config.py`

**Settings Class:**
- Inherits from `PydanticSettings`
- Loads from environment variables
- `.env` file support

**Configuration Categories:**

1. **Redis Settings:**
   - `REDIS_URL` - Connection string (default: `redis://localhost:6379/0`)
   - `JOB_KEY_PREFIX` - Job key prefix (default: `"job:"`)
   - `CACHE_KEY_PREFIX` - Cache key prefix (default: `"cache:"`)
   - `JOB_EXPIRATION` - Job TTL in seconds (default: 3600)
   - `CACHE_EXPIRATION` - Cache TTL in seconds (default: 86400)

2. **AI Configuration:**
   - `DEMO_MODE` - Bypass AI (default: False)
   - `AI_PROVIDER` - openai|google|groq|ollama (default: ollama)
   - `AI_MODEL` - Model identifier (default: "llama3.1")
   - `OPENAI_API_KEY` - OpenAI API key
   - `GEMINI_API_KEY` - Google API key
   - `GROQ_API_KEY` - Groq API key
   - `OLLAMA_BASE_URL` - Ollama server URL (default: `http://localhost:11434/v1`)
   - `MAX_AI_TOKENS` - Max tokens (default: 4096)
   - `AI_TEMPERATURE` - Temperature (default: 0.2)

3. **Artifact Constraints:**
   - `MAX_CONTENT_SIZE` - Max bytes (default: 500000)
   - `MAX_ENDPOINTS` - Max endpoints (default: 100)
   - `MAX_COMPONENTS` - Max components (default: 50)
   - `MAX_SECTIONS` - Max sections (default: 50)

4. **Logging:**
   - `LOG_LEVEL` - Log level (default: "INFO")

**Model Factory:**
- `get_model()` - Returns configured Pydantic AI model
- Supports multiple providers
- Provider-specific initialization

## API Routes

### Analysis Router (`app/routers/analysis.py`)

**Endpoints:**

1. **POST `/artifacts/analyze`**
   - Submit artifact for analysis
   - Request: `AnalysisRequest` (content, content_type, metadata)
   - Response: `JobResponse` (job_id, status, progress_hint)
   - Behavior:
     - Computes content hash (SHA256)
     - Checks Redis cache
     - If cache hit: returns immediately with cached result
     - If cache miss: creates job, queues background task, returns job_id

2. **GET `/jobs/{job_id}`**
   - Get job status
   - Response: `JobResponse`
   - Returns 404 if job not found

3. **GET `/jobs/{job_id}/result`**
   - Get analysis result
   - Response: `AnalysisResult`
   - Returns 400 if job not completed
   - Returns 404 if job not found

4. **GET `/jobs`**
   - List all jobs
   - Response: `JobListResponse`
   - Scans Redis for all job keys
   - Calculates created_at from TTL
   - Sorted by created_at (newest first)

**Background Task: `run_analysis_task`**

Async function that processes analysis:

1. **Size Guardrail:**
   - Checks content size against `MAX_CONTENT_SIZE`
   - Raises ValueError if exceeded

2. **Normalization:**
   - Calls `normalize_artifact()` based on content type
   - Updates job status: "Normalizing artifact..."

3. **Heuristics:**
   - Calls `run_heuristics()` on normalized artifact
   - Updates job status: "Running heuristics..."

4. **AI Synthesis:**
   - Prepares `AgentInput` with normalized artifact, findings, metadata
   - Calls AI agent with system prompt
   - Updates job status: "Synthesizing with AI..."

5. **Result Storage:**
   - Updates job with COMPLETED status
   - Stores result and markdown in Redis
   - Caches result with content hash

6. **Error Handling:**
   - Catches exceptions
   - Updates job with FAILED status
   - Logs error details

### Feedback Router (`app/routers/feedback.py`)

**POST `/feedback`**
- Stub endpoint
- Returns success message
- TODO: Implement feedback storage

## Business Logic

### Normalization (`app/logic/analysis.py`)

**`normalize_artifact(content, content_type)`**

Converts raw content into structured `NormalizedArtifact`:

**OpenAPI Normalization:**
- Parses JSON/YAML
- Extracts endpoints from `paths`
- For each endpoint:
  - Extracts path and HTTP method
  - Checks for security schemes
  - Checks for pagination parameters (page, offset, limit)
  - Checks for versioning (path contains `/v` or version in info)
- Falls back to regex if JSON parsing fails
- Limits to `MAX_ENDPOINTS`

**Architecture Normalization:**
- Regex extraction of services/microservices
- Keyword search for components:
  - Database: postgres, mysql, mongodb, redis, db, database
  - Queue: rabbitmq, kafka, sqs, pubsub, queue
  - Cache: redis, memcached, cache
- Limits to `MAX_COMPONENTS`

**Markdown Normalization:**
- Splits by heading lines (starting with `#`)
- Creates sections dictionary
- Limits to `MAX_SECTIONS`

### Heuristics (`app/logic/analysis.py`)

**`run_heuristics(normalized)`**

Rule-based analysis generating `HeuristicFinding` objects:

**OpenAPI Heuristics:**
- Unsecured write endpoints (non-GET without security)
- Missing pagination (GET endpoints with "list" in path)
- Missing API versioning (no version in paths or headers)

**Architecture Heuristics:**
- Missing security architecture (no auth/security keywords)
- Single point of failure (single database or monolithic structure)

**Markdown Heuristics:**
- Missing documentation sections (security, scaling, deployment, monitoring)

**Finding Structure:**
- title: Short description
- description: Detailed explanation
- category: Security|Reliability|Documentation|Maintainability|Performance
- severity: High|Medium|Low
- confidence: high|medium|low
- source: openapi|architecture|documentation
- rationale: Why this matters
- remediation: How to fix

### Demo Mode (`app/logic/demo.py`)

**`DemoAnalysisAgent`**

Mock AI agent for testing:
- Simulates 3-second processing delay
- Generates realistic analysis data
- Uses heuristic findings as base
- Creates charts with sample data
- Calculates production readiness score
- Returns structured `AnalysisData`

## Data Models

### Schemas (`app/schemas/analysis.py`)

**Enums:**
- `Severity`: HIGH, MEDIUM, LOW
- `ContentType`: MARKDOWN, OPENAPI_YAML, OPENAPI_JSON, ARCHITECTURE
- `JobStatus`: QUEUED, RUNNING, COMPLETED, FAILED

**Core Models:**

1. **Endpoint**
   - path, method, secured, has_pagination, has_versioning

2. **Component**
   - name, type, description (optional)

3. **NormalizedArtifact**
   - kind, services, endpoints, components, raw_sections

4. **HeuristicFinding**
   - title, description, category, severity, confidence, source, rationale, remediation

5. **AnalysisMetadata**
   - repo, team, risk_tolerance, depth (all optional)

6. **AnalysisRequest**
   - content, content_type, metadata

7. **JobResponse**
   - job_id, status, progress_hint

8. **Finding**
   - title, description, category, severity, rationale, remediation

9. **ChartDataPoint**
   - label, value

10. **Chart**
    - title, type, description, data

11. **AnalysisData**
    - production_readiness_score, summary, findings, charts, suggested_next_steps, markdown_report

12. **AnalysisResult**
    - job_id, status, result, markdown

13. **AgentInput**
    - normalized_artifact, heuristic_findings, metadata

14. **JobListItem**
    - job_id, status, progress_hint, created_at

15. **JobListResponse**
    - jobs, total, note

## Redis Integration

### Connection Management (`app/redis_client.py`)

**RedisClient Class:**
- Singleton pattern
- Async connection via `redis.asyncio`
- `connect()` - Initialize connection
- `disconnect()` - Close connection
- `get_client()` - Get connection instance

**Helper:**
- `get_redis()` - Convenience function

**Usage:**
- Called during FastAPI lifespan
- Used in routers for job/cache operations
- Decode responses enabled

## AI Integration

### Pydantic AI Agent

**Agent Configuration:**
- Model from settings
- Output type: `AnalysisData`
- Dependencies type: `AgentInput`
- Retries: 3
- Output retries: 3
- Model settings: max_tokens, temperature

**System Prompt:**
- Expert software architect persona
- Interpretation rules for confidence levels
- Tasks: prioritize findings, compute score, generate summary, create charts
- Strict output format requirements (JSON only)
- Input data provided as JSON in prompt

**Agent Input:**
- Normalized artifact
- Heuristic findings
- Metadata

**Agent Output:**
- Structured `AnalysisData` via Pydantic validation
- Guaranteed schema compliance

## Error Handling

### HTTP Exceptions

- 404: Job not found
- 400: Job not completed (when fetching result)
- 500: Internal server errors (unhandled exceptions)

### Validation Errors

- Pydantic automatically validates request bodies
- Returns 422 for invalid data
- Detailed error messages

### Background Task Errors

- Caught and logged
- Job status set to FAILED
- Error message stored in progress_hint

## Logging

### Loguru Configuration

- Colorized output
- Format: timestamp | level | module:function:line | message
- Log level from settings
- Structured logging for debugging

### Log Points

- Startup/shutdown
- Job lifecycle (queued, running, completed, failed)
- Cache hits/misses
- AI agent calls
- Errors with stack traces

## Performance Considerations

### Async Operations

- All I/O is async (Redis, AI calls)
- Background tasks for long-running analysis
- Non-blocking request handling

### Caching Strategy

- Content hash-based caching
- 24-hour TTL for cache
- Reduces redundant AI calls
- Improves response time for duplicate content

### Resource Limits

- Content size limits prevent DoS
- Endpoint/component/section limits prevent memory issues
- Job expiration prevents unbounded growth

## Security

### Input Validation

- Pydantic schema validation
- Content size limits
- Type checking

### CORS

- Currently permissive (`allow_origins=["*"]`)
- TODO: Restrict in production

### Authentication

- None currently
- TODO: Add API keys or OAuth

## Deployment

### Docker

**Base Image:** Python 3.12 slim

**Build Process:**
1. Install UV package manager
2. Copy application code
3. Run `uv sync --locked --no-cache`
4. Execute with `fastapi run app/main.py --port 8080`

**Port:** 8080

**Environment Variables:**
- Set via docker-compose or .env file
- Redis URL for container networking

### Health Check

**GET `/health`**
- Returns `{"status": "healthy"}`
- Used by load balancers
- No dependencies checked (TODO: add Redis health check)

## Testing

Currently no tests. Recommended:

- Unit tests for normalization logic
- Unit tests for heuristics
- Integration tests for API endpoints
- Mock AI agent for testing
- Redis test container for integration tests

## Future Improvements

- Authentication/authorization
- Rate limiting
- Request queuing (Celery, RQ)
- Database for persistent job history
- WebSocket support for real-time updates
- Metrics and monitoring (Prometheus)
- Distributed tracing
- API versioning
- OpenAPI schema generation
- Background job retry logic
- Job cancellation
- Batch analysis support


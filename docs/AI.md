# AI System Documentation

## Overview

The AI system in Faultline.ai uses Pydantic AI to integrate with multiple LLM providers. It synthesizes heuristic findings with contextual analysis to generate comprehensive production-readiness reports.

## Architecture

### Integration Layer

**Framework:** Pydantic AI 1.35.0+

**Purpose:**
- Structured output guarantees via Pydantic models
- Type-safe AI integration
- Multiple provider abstraction
- Built-in retry logic

### Agent Configuration

**Location:** `server/app/routers/analysis.py`

**Agent Setup:**
```python
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
```

**Configuration:**
- Retries: 3 attempts on failure
- Output retries: 3 attempts for valid schema
- Max tokens: 4096 (configurable)
- Temperature: 0.2 (low for consistency)

## Supported Providers

### 1. OpenAI

**Configuration:**
- Provider: `openai`
- Model: Any OpenAI model identifier (e.g., `gpt-4`, `gpt-3.5-turbo`)
- API Key: `OPENAI_API_KEY` environment variable

**Implementation:**
- Uses `OpenAIChatModel` from Pydantic AI
- `OpenAIProvider` with API key

**Usage:**
```python
AI_PROVIDER=openai
AI_MODEL=gpt-4
OPENAI_API_KEY=sk-...
```

### 2. Google (Gemini)

**Configuration:**
- Provider: `google`
- Model: Gemini model identifier
- API Key: `GEMINI_API_KEY` environment variable

**Implementation:**
- Uses `GoogleModel` from Pydantic AI
- `GoogleProvider` with API key

**Usage:**
```python
AI_PROVIDER=google
AI_MODEL=gemini-pro
GEMINI_API_KEY=...
```

### 3. Groq

**Configuration:**
- Provider: `groq`
- Model: Groq model identifier
- API Key: `GROQ_API_KEY` environment variable

**Implementation:**
- Uses `GroqModel` from Pydantic AI
- `GroqProvider` with API key

**Usage:**
```python
AI_PROVIDER=groq
AI_MODEL=llama-3.1-70b-versatile
GROQ_API_KEY=...
```

### 4. Ollama (Local)

**Configuration:**
- Provider: `ollama`
- Model: Local model name (e.g., `llama3.1`)
- Base URL: `OLLAMA_BASE_URL` (default: `http://localhost:11434/v1`)

**Implementation:**
- Uses `OpenAIChatModel` with `OllamaProvider`
- Compatible with OpenAI API format
- No API key required

**Usage:**
```python
AI_PROVIDER=ollama
AI_MODEL=llama3.1
OLLAMA_BASE_URL=http://localhost:11434/v1
```

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull model
ollama pull llama3.1

# Start server (runs automatically)
```

## Model Factory

**Location:** `server/app/config.py`

**Function:** `get_model()`

**Behavior:**
- Reads `AI_PROVIDER` setting
- Dynamically imports provider-specific models
- Returns configured model instance
- Raises error for unsupported providers

**Provider Selection:**
```python
match self.AI_PROVIDER:
    case "openai":
        return OpenAIChatModel(self.AI_MODEL, provider=OpenAIProvider(...))
    case "google":
        return GoogleModel(self.AI_MODEL, provider=GoogleProvider(...))
    case "groq":
        return GroqModel(self.AI_MODEL, provider=GroqProvider(...))
    case "ollama":
        return OpenAIChatModel(self.AI_MODEL, provider=OllamaProvider(...))
```

## System Prompt

**Location:** `server/app/routers/analysis.py`

**Purpose:**
- Defines agent persona (expert software architect)
- Sets interpretation rules
- Specifies tasks
- Enforces output format

**Key Sections:**

1. **Persona:**
   - Expert software architect
   - Production-readiness review specialist

2. **Input Data:**
   - Normalized artifact
   - Heuristic findings with confidence levels
   - Metadata

3. **Interpretation Rules:**
   - High confidence = factual
   - Medium confidence = likely but uncertain
   - Low confidence = weak signals, don't overemphasize
   - Only add findings if directly implied by artifact
   - Don't invent technologies or failures

4. **Tasks:**
   - Prioritize findings by production risk
   - Provide actionable remediation
   - Compute production readiness score (0-100)
   - Write executive summary
   - Generate exactly 3 charts:
     - Findings by severity
     - Scalability/reliability/security risk
     - System cost/complexity/operational risk

5. **Output Rules:**
   - Raw JSON only (no code blocks, no wrappers)
   - Top-level keys: production_readiness_score, summary, findings, charts, suggested_next_steps, markdown_report
   - No stringified nested objects
   - No explanations outside JSON
   - Score must be integer
   - Markdown must be valid
   - Charts must be realistic and consistent

**Prompt Structure:**
```
You are an expert software architect...

INTERPRETATION RULES:
- ...

TASKS:
1. ...

OUTPUT RULES (STRICT):
- ...

BEGIN INPUT DATA (READ-ONLY):
```json
{agent_input_json}
```
END INPUT DATA
```

## Input Data Structure

### AgentInput

**Schema:** `app/schemas/analysis.py`

**Fields:**
- `normalized_artifact`: NormalizedArtifact
- `heuristic_findings`: List[HeuristicFinding]
- `metadata`: AnalysisMetadata

**Serialization:**
- Converted to JSON via `model_dump_json()`
- Embedded in system prompt
- Read-only context for agent

### NormalizedArtifact

**Structure:**
- `kind`: "openapi" | "architecture" | "markdown"
- `services`: List[str] (for architecture)
- `endpoints`: List[Endpoint] (for OpenAPI)
- `components`: List[Component] (for architecture)
- `raw_sections`: Dict[str, str] (for markdown)

### HeuristicFinding

**Structure:**
- `title`: Short description
- `description`: Detailed explanation
- `category`: Security | Reliability | Documentation | etc.
- `severity`: High | Medium | Low
- `confidence`: high | medium | low
- `source`: openapi | architecture | documentation
- `rationale`: Why this matters
- `remediation`: How to fix

### AnalysisMetadata

**Structure:**
- `repo`: Optional repository identifier
- `team`: Optional team name
- `risk_tolerance`: Optional risk level
- `depth`: Optional analysis depth

## Output Structure

### AnalysisData

**Schema:** `app/schemas/analysis.py`

**Fields:**
- `production_readiness_score`: int (0-100)
- `summary`: str (executive summary)
- `findings`: List[Finding] (enhanced findings)
- `charts`: List[Chart] (visualization data)
- `suggested_next_steps`: List[str] (action items)
- `markdown_report`: str (full markdown report)

### Finding

**Structure:**
- `title`: str
- `description`: str
- `category`: str
- `severity`: str (High | Medium | Low)
- `rationale`: str
- `remediation`: str

### Chart

**Structure:**
- `title`: str
- `type`: str ("line" | "bar" | "pie")
- `description`: str
- `data`: List[ChartDataPoint]

### ChartDataPoint

**Structure:**
- `label`: str
- `value`: float

## Processing Flow

### 1. Input Preparation

```python
agent_input = AgentInput(
    normalized_artifact=normalized,
    heuristic_findings=heuristic_findings,
    metadata=AnalysisMetadata(**metadata),
)
```

### 2. Agent Execution

```python
result = await analysis_agent.run(
    "Begin synthesis based on provided artifact data.",
    deps=agent_input,
)
```

### 3. Output Extraction

```python
analysis_data = result.output  # Validated AnalysisData
```

### 4. Result Storage

```python
result_payload = analysis_data.model_dump(exclude={"markdown_report"})
markdown = analysis_data.markdown_report
```

## Demo Mode

**Location:** `server/app/logic/demo.py`

**Purpose:**
- Bypass AI for testing
- Generate realistic mock data
- Simulate processing delay

**Activation:**
```python
DEMO_MODE=True
```

**Behavior:**
- Uses `DemoAnalysisAgent` instead of real agent
- 3-second delay to simulate processing
- Generates analysis from heuristic findings
- Creates sample charts
- Calculates score based on findings

**Use Cases:**
- Development without API keys
- Testing without AI costs
- CI/CD pipelines
- Demo environments

## Error Handling

### Retry Logic

**Agent-Level:**
- 3 retries on agent failure
- 3 output retries for schema validation
- Automatic backoff (handled by Pydantic AI)

### Validation Errors

**Pydantic Validation:**
- Output must match `AnalysisData` schema
- Automatic validation on agent response
- Raises error if invalid

### Timeout Handling

**Not Currently Configured:**
- TODO: Add timeout to agent calls
- Prevent hanging on slow models

## Performance

### Token Limits

**Max Tokens:** 4096 (configurable)
- Input: Normalized artifact + findings + metadata
- Output: Analysis data + markdown report
- May truncate for large artifacts

### Processing Time

**Varies by Provider:**
- OpenAI GPT-4: ~5-15 seconds
- Groq: ~2-5 seconds
- Ollama (local): ~10-30 seconds (depends on hardware)
- Google Gemini: ~5-10 seconds

### Caching

**Content Hash Caching:**
- Results cached by content hash
- 24-hour TTL
- Reduces redundant AI calls
- Significant cost/time savings

## Cost Considerations

### Token Usage

**Input Tokens:**
- Normalized artifact JSON
- Heuristic findings
- Metadata
- System prompt

**Output Tokens:**
- Analysis data JSON
- Markdown report
- Charts data

### Provider Costs

**OpenAI:**
- GPT-4: ~$0.03/1K input, $0.06/1K output
- GPT-3.5-turbo: ~$0.0015/1K input, $0.002/1K output

**Groq:**
- Fast inference, competitive pricing
- Good for high-volume usage

**Google:**
- Gemini Pro: Competitive pricing
- Free tier available

**Ollama:**
- Free (local compute)
- No API costs
- Requires local infrastructure

## Best Practices

### Model Selection

**For Production:**
- Use GPT-4 or equivalent for accuracy
- Consider Groq for speed/cost balance
- Use Ollama for privacy-sensitive deployments

**For Development:**
- Use demo mode or Ollama
- Avoid unnecessary API calls

### Prompt Engineering

**Current Approach:**
- Detailed system prompt
- Structured input data
- Strict output format
- Clear interpretation rules

**Improvements:**
- A/B test prompt variations
- Fine-tune for specific artifact types
- Add few-shot examples

### Error Handling

**Recommended:**
- Log all AI errors
- Track token usage
- Monitor response times
- Alert on high failure rates

## Monitoring

### Metrics to Track

- Token usage per request
- Response time per provider
- Success/failure rates
- Cache hit rate
- Cost per analysis

### Logging

**Current:**
- Job start/completion logged
- Errors logged with stack traces

**Recommended:**
- Log token counts
- Log provider used
- Log response times
- Track costs

## Future Improvements

### Model Fine-Tuning

- Fine-tune on production-readiness reviews
- Domain-specific improvements
- Reduced token usage

### Multi-Model Ensemble

- Run multiple models
- Compare outputs
- Consensus scoring

### Streaming Responses

- Stream markdown report generation
- Real-time updates to frontend
- Better UX for long analyses

### Prompt Optimization

- A/B testing framework
- Dynamic prompt selection
- Context-aware prompts

### Cost Optimization

- Token usage optimization
- Caching strategies
- Model selection based on artifact size
- Batch processing

### Quality Assurance

- Output validation rules
- Consistency checks
- Human review workflow
- Feedback loop integration


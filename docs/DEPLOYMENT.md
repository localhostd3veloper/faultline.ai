# Deployment & Scalability Documentation

## High Request Volume Handling

### Current Implementation

#### Async Processing and Background Jobs

**Current Approach:**
- FastAPI `BackgroundTasks` for async job processing
- Jobs are queued immediately and processed asynchronously
- Request returns job_id immediately (non-blocking)

**Implementation:**
```python
@router.post("/artifacts/analyze")
async def analyze_artifact(request: AnalysisRequest, background_tasks: BackgroundTasks):
    # Check cache first
    # If cache miss, create job and queue background task
    background_tasks.add_task(run_analysis_task, ...)
    return JobResponse(job_id=job_id, status=JobStatus.QUEUED)
```

**Limitations:**
- Background tasks run in the same process as the API server
- No distributed queue (single server only)
- No job prioritization
- No retry mechanism for failed jobs
- Background tasks lost if server restarts

#### Rate Limiting and Abuse Protection

**Current State:**
- ❌ No rate limiting implemented
- ✅ Content size limits (500KB max)
- ✅ Input validation via Pydantic
- ❌ No request throttling
- ❌ No IP-based blocking

**Existing Protections:**
- `MAX_CONTENT_SIZE: 500_000` bytes - Prevents DoS via large payloads
- `MAX_ENDPOINTS: 100` - Limits OpenAPI parsing
- `MAX_COMPONENTS: 50` - Limits architecture parsing
- `MAX_SECTIONS: 50` - Limits markdown parsing

#### AI Cost Control Strategies

**Current Implementation:**
- ✅ Content hash-based caching (24-hour TTL)
- ✅ Token limits (`MAX_AI_TOKENS: 4096`)
- ✅ Low temperature (0.2) for consistency
- ✅ Retry limits (3 agent retries, 3 output retries)
- ❌ No per-user rate limits
- ❌ No cost tracking/monitoring
- ❌ No budget alerts

**Cache Strategy:**
- SHA256 content hash for deduplication
- 24-hour cache expiration
- Instant return for duplicate content
- Significant cost savings for repeated analyses

#### Horizontal Scaling

**Current State:**
- ❌ Single FastAPI instance
- ✅ Stateless API (can scale horizontally)
- ✅ Redis for shared state
- ❌ No load balancer
- ❌ No auto-scaling

**Scaling Readiness:**
- Stateless API design (no in-memory state)
- Redis for job state (shared across instances)
- Docker containers (portable)
- Environment-based configuration

### Recommended Production Implementation

#### 1. Distributed Job Queue

**Replace FastAPI BackgroundTasks with Celery or RQ:**

**Option A: Celery (Recommended)**
```python
# Use Celery with Redis broker
from celery import Celery

celery_app = Celery(
    'faultline',
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

@celery_app.task(bind=True, max_retries=3)
def run_analysis_task_async(self, job_id, content, content_type, metadata, content_hash):
    # Existing analysis logic
    # Automatic retry on failure
    # Distributed across workers
```

**Benefits:**
- Distributed processing across multiple workers
- Automatic retry on failure
- Job prioritization
- Monitoring and visibility
- Persistent queue (survives restarts)

**Option B: AWS SQS + Lambda**
- Serverless job processing
- Automatic scaling
- Pay-per-use
- No infrastructure management

#### 2. Rate Limiting

**Implement using slowapi (FastAPI rate limiting):**

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.post("/artifacts/analyze")
@limiter.limit("10/minute")  # Per IP
async def analyze_artifact(...):
    ...
```

**Rate Limit Strategy:**
- **Anonymous users:** 5 requests/minute
- **Authenticated users:** 20 requests/minute
- **API keys:** 100 requests/minute
- **Burst allowance:** 2x limit for 10 seconds

**Additional Protections:**
- IP-based blocking for abuse
- Content hash rate limiting (prevent cache bypass)
- Per-user quotas (daily/monthly limits)

#### 3. Enhanced AI Cost Control

**Token Usage Tracking:**
```python
# Track token usage per request
token_usage = result.usage()
await track_token_usage(
    user_id=user_id,
    provider=settings.AI_PROVIDER,
    input_tokens=token_usage.request_tokens,
    output_tokens=token_usage.response_tokens,
    cost=calculate_cost(token_usage)
)
```

**Cost Control Measures:**
- Per-user daily token limits
- Budget alerts (80%, 100% thresholds)
- Automatic fallback to cheaper models at limits
- Cost reporting dashboard
- Provider cost comparison

**Caching Enhancements:**
- Extend cache TTL for popular content
- Cache warming for common artifacts
- Cache hit rate monitoring
- Cache invalidation strategy

#### 4. Horizontal Scaling Architecture

**Load Balancer:**
- AWS Application Load Balancer (ALB)
- Health checks on `/health` endpoint
- Sticky sessions (if needed)
- SSL termination

**Auto-Scaling:**
- AWS ECS/EKS with auto-scaling
- Scale based on:
  - CPU utilization (target: 70%)
  - Request queue depth
  - Response time (p95 < 2s)
- Min: 2 instances, Max: 20 instances

**Worker Pool:**
- Separate worker instances for job processing
- Scale independently from API servers
- Worker auto-scaling based on queue depth

## AWS Deployment Strategy

### Target Architecture

```
┌─────────────────┐
│   CloudFront    │  CDN for frontend
│   (CDN)         │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐  ┌──▼──────┐
│  S3   │  │  ALB    │  Application Load Balancer
│Static │  └────┬────┘
└───────┘       │
           ┌────┴────┐
           │        │
      ┌────▼───┐ ┌──▼────┐
      │  ECS   │ │  ECS  │  API Servers (multiple)
      │  API   │ │  API  │
      └────┬───┘ └───┬───┘
           │         │
      ┌────┴─────────┴────┐
      │                   │
┌─────▼─────┐      ┌──────▼──────┐
│   ECS     │      │  ElastiCache │
│  Workers  │      │   (Redis)    │
└─────┬─────┘      └─────────────┘
      │
┌─────▼─────┐
│   SQS     │  Job Queue (optional)
└───────────┘
```

### Deployment Approach: Container-Based

**Why Containers:**
- Consistent environments (dev/staging/prod)
- Easy horizontal scaling
- Infrastructure as code
- Version control for deployments
- Rollback capability

**Container Strategy:**
- **Frontend:** Next.js standalone build in container
- **Backend:** FastAPI in container
- **Workers:** Same container image, different entrypoint
- **Redis:** ElastiCache (managed service)

### Frontend Deployment

**Option A: S3 + CloudFront (Static Hosting)**

**Steps:**
1. Build Next.js with static export
2. Upload to S3 bucket
3. Configure CloudFront distribution
4. Custom domain with SSL (ACM)

**Benefits:**
- Low cost
- High performance (CDN)
- Automatic scaling
- No server management

**Configuration:**
```yaml
# Build for static export
next.config.ts:
  output: 'export'
  basePath: '/app'  # If needed
  assetPrefix: 'https://cdn.faultline.ai'
```

**Option B: ECS/Fargate (Container)**

**Use when:**
- Need server-side rendering
- Dynamic routing
- API routes in Next.js

**Configuration:**
- ECS task definition
- Fargate launch type
- Auto-scaling (1-5 instances)
- ALB target group

### Backend Deployment

**ECS Fargate (Recommended)**

**Why Fargate:**
- No EC2 management
- Automatic scaling
- Pay per use
- Security isolation

**Configuration:**
```yaml
# ECS Task Definition
family: faultline-api
networkMode: awsvpc
cpu: 1024  # 1 vCPU
memory: 2048  # 2 GB
containerDefinitions:
  - name: api
    image: {ECR_REPO}/faultline-api:latest
    portMappings:
      - containerPort: 8080
    environment:
      - REDIS_URL=redis://{ELASTICACHE_ENDPOINT}:6379/0
      - AI_PROVIDER=openai
      - LOG_LEVEL=INFO
```

**Auto-Scaling:**
```yaml
# ECS Service Auto-Scaling
minCapacity: 2
maxCapacity: 20
targetTrackingScalingPolicies:
  - targetValue: 70.0
    scaleInCooldown: 300
    scaleOutCooldown: 60
    metricType: CPUUtilization
```

**Worker Deployment:**
- Separate ECS service
- Same container image
- Different entrypoint: `celery worker`
- Scale based on SQS queue depth

### Independent Deployment

**Frontend and Backend are Deployed Separately:**

**Frontend:**
- Own CI/CD pipeline
- Deploys to S3/CloudFront or ECS
- No dependency on backend deployment
- Can deploy multiple times per day

**Backend:**
- Own CI/CD pipeline
- Deploys to ECS
- Blue/green or rolling deployments
- Health checks before traffic switch

**Benefits:**
- Independent release cycles
- Faster deployments
- Reduced risk (isolated failures)
- Team autonomy

### Infrastructure as Code

**Terraform (Recommended) or AWS CDK**

**Key Resources:**
```hcl
# ECS Cluster
resource "aws_ecs_cluster" "faultline" {
  name = "faultline"
}

# ECS Service (API)
resource "aws_ecs_service" "api" {
  cluster         = aws_ecs_cluster.faultline.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 2
  
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "faultline-redis"
  node_type           = "cache.t3.micro"
  port                = 6379
  num_cache_clusters  = 2  # Multi-AZ
}

# Application Load Balancer
resource "aws_lb" "api" {
  name               = "faultline-api"
  internal           = false
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.alb.id]
}
```

## CI/CD Strategy

### Pipeline Architecture

```
┌─────────────┐
│   GitHub    │  Source Control
│   / GitLab  │
└──────┬──────┘
       │
       │ Push to main/develop
       │
┌──────▼──────────────────┐
│   GitHub Actions /      │  CI Pipeline
│   GitLab CI /           │
│   AWS CodePipeline      │
└──────┬──────────────────┘
       │
       ├─► Lint & Test
       ├─► Build Docker Images
       ├─► Security Scan
       └─► Push to ECR
              │
              │
       ┌──────▼──────┐
       │   ECR       │  Container Registry
       └──────┬──────┘
              │
       ┌──────▼──────────────────┐
       │   CD Pipeline            │
       └──────┬───────────────────┘
              │
       ┌──────┴──────┐
       │            │
┌──────▼───┐  ┌─────▼────┐
│  Staging │  │  Production│
│  Deploy  │  │  Deploy    │
└──────────┘  └────────────┘
```

### CI Pipeline (Continuous Integration)

**Triggers:**
- Push to `main`, `develop`, or PR
- Manual trigger

**Steps:**

1. **Lint & Format Check**
   ```yaml
   - name: Lint Backend
     run: |
       cd server
       uv run isort --check .
       uv run ruff check .
   
   - name: Lint Frontend
     run: |
       cd client
       bun run lint
   ```

2. **Type Checking**
   ```yaml
   - name: Type Check Backend
     run: |
       cd server
       uv run mypy app/
   
   - name: Type Check Frontend
     run: |
       cd client
       bun run type-check
   ```

3. **Unit Tests**
   ```yaml
   - name: Test Backend
     run: |
       cd server
       uv run pytest tests/
   
   - name: Test Frontend
     run: |
       cd client
       bun run test
   ```

4. **Build Docker Images**
   ```yaml
   - name: Build Backend Image
     run: |
       docker build -t faultline-api:${{ github.sha }} ./server
       docker tag faultline-api:${{ github.sha }} $ECR_REGISTRY/faultline-api:${{ github.sha }}
       docker tag faultline-api:${{ github.sha }} $ECR_REGISTRY/faultline-api:latest
   
   - name: Build Frontend Image
     run: |
       docker build -t faultline-client:${{ github.sha }} ./client
       docker tag faultline-client:${{ github.sha }} $ECR_REGISTRY/faultline-client:${{ github.sha }}
   ```

5. **Security Scanning**
   ```yaml
   - name: Scan Backend Image
     run: |
       trivy image $ECR_REGISTRY/faultline-api:${{ github.sha }}
   
   - name: Scan Frontend Image
     run: |
       trivy image $ECR_REGISTRY/faultline-client:${{ github.sha }}
   ```

6. **Push to ECR**
   ```yaml
   - name: Push to ECR
     run: |
       aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
       docker push $ECR_REGISTRY/faultline-api:${{ github.sha }}
       docker push $ECR_REGISTRY/faultline-api:latest
       docker push $ECR_REGISTRY/faultline-client:${{ github.sha }}
   ```

### CD Pipeline (Continuous Deployment)

**Staging Deployment (Auto on `develop` branch):**

```yaml
- name: Deploy to Staging
  if: github.ref == 'refs/heads/develop'
  run: |
    # Update ECS service with new image
    aws ecs update-service \
      --cluster faultline-staging \
      --service api \
      --force-new-deployment \
      --task-definition faultline-api-staging
```

**Production Deployment (Manual approval on `main` branch):**

```yaml
- name: Deploy to Production
  if: github.ref == 'refs/heads/main'
  run: |
    # Blue/Green deployment
    aws ecs create-deployment \
      --cluster faultline-prod \
      --service api \
      --task-definition faultline-api-prod \
      --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200"
    
    # Wait for health checks
    aws ecs wait services-stable \
      --cluster faultline-prod \
      --services api
```

**Deployment Strategies:**

1. **Blue/Green (Recommended for Production)**
   - Deploy new version alongside old
   - Health checks before traffic switch
   - Instant rollback capability
   - Zero downtime

2. **Rolling Update (Staging)**
   - Gradual replacement of instances
   - Faster deployment
   - Some risk during transition

3. **Canary (High-Traffic Production)**
   - Deploy to 10% of traffic first
   - Monitor metrics
   - Gradually increase to 100%

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, develop]
  workflow_dispatch:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      - name: Run CI
        run: |
          # Lint, test, build, scan
          make ci
  
  deploy-staging:
    needs: ci
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: |
          aws ecs update-service --cluster staging --service api --force-new-deployment
  
  deploy-production:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Production
        run: |
          aws ecs update-service --cluster prod --service api --force-new-deployment
```

## Environment Separation

### Environment Strategy

**Three Environments:**

1. **Development (Local)**
   - Docker Compose
   - Local Redis
   - Demo mode or local Ollama
   - Hot reload enabled

2. **Staging**
   - Mirrors production
   - Smaller instance sizes
   - Test data
   - Pre-production validation

3. **Production**
   - Full scale
   - Production data
   - Monitoring and alerts
   - High availability

### Configuration Management

**Environment Variables:**

```bash
# Development (.env.local)
REDIS_URL=redis://localhost:6379/0
AI_PROVIDER=ollama
AI_MODEL=llama3.1
DEMO_MODE=false
LOG_LEVEL=DEBUG
MAX_CONTENT_SIZE=500000

# Staging (.env.staging)
REDIS_URL=redis://staging-redis.cache.amazonaws.com:6379/0
AI_PROVIDER=groq
AI_MODEL=llama-3.1-70b-versatile
DEMO_MODE=false
LOG_LEVEL=INFO
MAX_CONTENT_SIZE=500000

# Production (.env.prod)
REDIS_URL=redis://prod-redis.cache.amazonaws.com:6379/0
AI_PROVIDER=openai
AI_MODEL=gpt-4
DEMO_MODE=false
LOG_LEVEL=WARN
MAX_CONTENT_SIZE=500000
```

**AWS Systems Manager Parameter Store:**

```python
# Load from Parameter Store in production
import boto3

ssm = boto3.client('ssm')

def get_parameter(name: str) -> str:
    response = ssm.get_parameter(
        Name=f'/faultline/{ENV}/{name}',
        WithDecryption=True
    )
    return response['Parameter']['Value']

# Usage
REDIS_URL = get_parameter('redis_url')
OPENAI_API_KEY = get_parameter('openai_api_key')
```

**AWS Secrets Manager (for sensitive data):**

```python
import boto3

secrets = boto3.client('secretsmanager')

def get_secret(name: str) -> dict:
    response = secrets.get_secret_value(
        SecretId=f'faultline/{ENV}/{name}'
    )
    return json.loads(response['SecretString'])

# Usage
ai_credentials = get_secret('ai_credentials')
```

### Environment-Specific Resources

**Development:**
- Single ECS task
- Local Redis (Docker)
- No load balancer
- Public IP for testing

**Staging:**
- 2 ECS tasks (min)
- ElastiCache cache.t3.micro
- ALB (internal)
- Staging domain: `staging.faultline.ai`

**Production:**
- 2-20 ECS tasks (auto-scaling)
- ElastiCache cache.r6g.large (multi-AZ)
- ALB (public)
- Production domain: `api.faultline.ai`
- CloudFront CDN

### Database/State Separation

**Redis:**
- Separate ElastiCache clusters per environment
- Different cache keys (optional prefix)
- No data sharing between environments

**Job State:**
- Environment-specific job IDs
- Separate job queues
- No cross-environment access

### Monitoring Separation

**CloudWatch:**
- Separate log groups: `/aws/ecs/faultline-dev`, `/aws/ecs/faultline-staging`, `/aws/ecs/faultline-prod`
- Environment-specific dashboards
- Separate alarms

**Metrics:**
- Tag resources with `Environment=dev|staging|prod`
- Filter metrics by environment
- Separate SNS topics for alerts

### Access Control

**IAM Roles:**
- `FaultlineDevRole` - Development access
- `FaultlineStagingRole` - Staging deployment
- `FaultlineProdRole` - Production deployment (restricted)

**Deployment Permissions:**
- Developers: Can deploy to staging
- DevOps: Can deploy to production
- Automated: CI/CD has staging access, production requires approval

## Summary

### Current State
- ✅ Async processing (FastAPI BackgroundTasks)
- ✅ Content-based caching
- ✅ Stateless API design
- ✅ Docker containers
- ❌ No rate limiting
- ❌ No distributed queue
- ❌ No auto-scaling
- ❌ No production deployment

### Recommended Production Setup
- ✅ Celery/RQ for distributed job processing
- ✅ Rate limiting (slowapi)
- ✅ AWS ECS Fargate for containers
- ✅ ElastiCache for Redis
- ✅ ALB for load balancing
- ✅ Auto-scaling based on metrics
- ✅ CI/CD with GitHub Actions
- ✅ Environment separation (dev/staging/prod)
- ✅ Infrastructure as Code (Terraform)
- ✅ Monitoring and alerting (CloudWatch)

This architecture provides:
- **Scalability:** Horizontal scaling, auto-scaling
- **Reliability:** Multi-AZ, health checks, rollback
- **Cost Control:** Caching, rate limiting, token tracking
- **Security:** IAM roles, secrets management, VPC isolation
- **Maintainability:** IaC, CI/CD, environment separation


# Redis Documentation

## Overview

Redis is used as the primary data store for job state management and result caching in Faultline.ai. It provides fast in-memory storage with TTL-based expiration for automatic cleanup.

## Architecture

### Connection Management

**Location:** `server/app/redis_client.py`

**Pattern:** Singleton

**Implementation:**
```python
class RedisClient:
    _instance: Optional[redis.Redis] = None
    
    @classmethod
    async def connect(cls):
        # Initialize connection
    
    @classmethod
    def get_client(cls) -> redis.Redis:
        # Get connection instance
```

**Connection:**
- Async Redis client (`redis.asyncio`)
- URL-based connection string
- Decode responses enabled (returns strings, not bytes)
- Connection established during FastAPI lifespan startup
- Disconnected during shutdown

### Configuration

**Environment Variable:** `REDIS_URL`

**Default:** `redis://localhost:6379/0`

**Format:** `redis://[host]:[port]/[db]`

**Docker Compose:**
- Service name: `redis`
- Image: `redis:alpine`
- Port: `6379`
- Health check: `redis-cli ping`

## Key Patterns

### 1. Job Storage

**Key Format:** `job:{job_id}`

**Prefix:** `JOB_KEY_PREFIX` (default: `"job:"`)

**Structure:**
```json
{
  "job_id": "uuid-string",
  "status": "queued|running|completed|failed",
  "content_hash": "sha256-hash",
  "metadata": {...},
  "progress_hint": "Current step...",
  "result": {...},  // Only when completed
  "markdown": "..."  // Only when completed
}
```

**TTL:** `JOB_EXPIRATION` (default: 3600 seconds = 1 hour)

**Operations:**
- `SET` - Create/update job
- `GET` - Retrieve job
- `TTL` - Get remaining expiration time
- `SCAN` - List all jobs (for `/jobs` endpoint)

**Example:**
```python
job_key = f"{settings.JOB_KEY_PREFIX}{job_id}"
job_data = {
    "job_id": job_id,
    "status": "queued",
    "content_hash": content_hash,
    "metadata": {...},
    "progress_hint": "Job queued"
}
await redis.set(job_key, json.dumps(job_data), ex=settings.JOB_EXPIRATION)
```

### 2. Result Caching

**Key Format:** `cache:{content_hash}`

**Prefix:** `CACHE_KEY_PREFIX` (default: `"cache:"`)

**Content Hash:** SHA256 of artifact content

**Structure:**
```json
{
  "result": {
    "production_readiness_score": 85,
    "summary": "...",
    "findings": [...],
    "charts": [...],
    "suggested_next_steps": [...]
  },
  "markdown": "# Report\n\n..."
}
```

**TTL:** `CACHE_EXPIRATION` (default: 86400 seconds = 24 hours)

**Purpose:**
- Avoid redundant AI processing
- Instant results for duplicate content
- Significant cost/time savings

**Operations:**
- `SET` - Cache result
- `GET` - Retrieve cached result

**Example:**
```python
content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
cache_key = f"{settings.CACHE_KEY_PREFIX}{content_hash}"

# Check cache
cached = await redis.get(cache_key)
if cached:
    cache_data = json.loads(cached)
    # Return immediately

# Store cache
cache_data = {
    "result": result_payload,
    "markdown": markdown_report
}
await redis.set(cache_key, json.dumps(cache_data), ex=settings.CACHE_EXPIRATION)
```

## Data Flow

### Job Lifecycle

```
1. CREATE
   POST /artifacts/analyze
   → Compute content_hash
   → Check cache (cache:{hash})
   → If cache hit: return immediately
   → If cache miss:
      → Create job (job:{job_id})
      → Status: QUEUED
      → TTL: 1 hour

2. UPDATE (Background Task)
   → Status: RUNNING
   → progress_hint: "Normalizing artifact..."
   → progress_hint: "Running heuristics..."
   → progress_hint: "Synthesizing with AI..."

3. COMPLETE
   → Status: COMPLETED
   → result: {...}
   → markdown: "..."
   → Cache result (cache:{hash})
   → TTL: 24 hours

4. FAIL
   → Status: FAILED
   → progress_hint: "Error: ..."

5. EXPIRE
   → TTL reaches 0
   → Automatic deletion
   → Job no longer accessible
```

### Cache Flow

```
1. ANALYSIS REQUEST
   → Compute content_hash
   → Check cache:{hash}

2. CACHE HIT
   → Return cached result immediately
   → Create job with COMPLETED status
   → No AI processing needed

3. CACHE MISS
   → Process analysis
   → Store result in cache:{hash}
   → TTL: 24 hours
```

## Operations

### Job Operations

**Create Job:**
```python
job_key = f"{settings.JOB_KEY_PREFIX}{job_id}"
job_data = json.dumps({
    "job_id": job_id,
    "status": JobStatus.QUEUED,
    "content_hash": content_hash,
    "metadata": metadata,
    "progress_hint": "Job queued"
})
await redis.set(job_key, job_data, ex=settings.JOB_EXPIRATION)
```

**Update Job:**
```python
job_data = await redis.get(job_key)
data = json.loads(job_data)
data["status"] = JobStatus.RUNNING
data["progress_hint"] = "Processing..."
if result:
    data["result"] = result
if markdown:
    data["markdown"] = markdown
await redis.set(job_key, json.dumps(data), ex=settings.JOB_EXPIRATION)
```

**Get Job:**
```python
job_data = await redis.get(job_key)
if not job_data:
    raise HTTPException(404, "Job not found")
data = json.loads(job_data)
```

**List Jobs:**
```python
job_pattern = f"{settings.JOB_KEY_PREFIX}*"
job_keys = []
async for key in redis.scan_iter(match=job_pattern):
    job_keys.append(key)

jobs = []
for job_key in job_keys:
    job_data = await redis.get(job_key)
    if job_data:
        data = json.loads(job_data)
        # Calculate created_at from TTL
        ttl = await redis.ttl(job_key)
        if ttl > 0:
            elapsed = settings.JOB_EXPIRATION - ttl
            created_at = current_time_ms - (elapsed * 1000)
        jobs.append({...})
```

### Cache Operations

**Check Cache:**
```python
cache_key = f"{settings.CACHE_KEY_PREFIX}{content_hash}"
cached_result = await redis.get(cache_key)
if cached_result:
    cache_data = json.loads(cached_result)
    return cache_data
```

**Store Cache:**
```python
cache_data = {
    "result": result_payload,
    "markdown": markdown_report
}
await redis.set(cache_key, json.dumps(cache_data), ex=settings.CACHE_EXPIRATION)
```

## TTL Management

### Job Expiration

**TTL:** 1 hour (3600 seconds)

**Purpose:**
- Automatic cleanup of old jobs
- Prevent unbounded growth
- Memory management

**Calculation:**
- Set on job creation
- Reset on each update (maintains expiration)
- Can calculate `created_at` from remaining TTL

**Example:**
```python
ttl = await redis.ttl(job_key)
if ttl > 0:
    elapsed_seconds = settings.JOB_EXPIRATION - ttl
    created_at = current_time_ms - (elapsed_seconds * 1000)
```

### Cache Expiration

**TTL:** 24 hours (86400 seconds)

**Purpose:**
- Balance between cache hits and freshness
- Allow updates to analysis logic
- Reasonable storage duration

**Note:**
- Cache persists longer than jobs
- Same content can be analyzed multiple times within 24 hours
- After expiration, analysis runs again (may get updated results)

## Serialization

### JSON Format

**All data stored as JSON strings:**
- `json.dumps()` for storage
- `json.loads()` for retrieval
- Ensures compatibility and readability

**Benefits:**
- Human-readable in Redis CLI
- Easy debugging
- No binary encoding issues

**Example:**
```python
# Store
data = {"status": "completed", "result": {...}}
await redis.set(key, json.dumps(data), ex=ttl)

# Retrieve
raw_data = await redis.get(key)
data = json.loads(raw_data)
```

## Error Handling

### Connection Errors

**Handled in:**
- `RedisClient.connect()` - Logs connection errors
- FastAPI lifespan - Fails startup if Redis unavailable

**Recovery:**
- Automatic reconnection (handled by redis.asyncio)
- Connection pool management

### Key Not Found

**Job Not Found:**
```python
job_data = await redis.get(job_key)
if not job_data:
    raise HTTPException(404, "Job not found")
```

**Cache Miss:**
```python
cached = await redis.get(cache_key)
if not cached:
    # Proceed with analysis
```

### JSON Parsing Errors

**Handled:**
```python
try:
    data = json.loads(job_data)
except json.JSONDecodeError:
    logger.exception(f"Job {job_id} data is invalid")
    continue  # Skip invalid jobs
```

## Performance

### Read Performance

**Job Lookup:**
- O(1) key lookup
- Fast in-memory access
- Sub-millisecond response

**Cache Lookup:**
- O(1) key lookup
- Instant results for cached content
- Significant time savings

### Write Performance

**Job Updates:**
- O(1) key update
- Atomic operations
- No locking required

**Cache Writes:**
- O(1) key write
- Background operation
- Doesn't block requests

### Memory Usage

**Job Storage:**
- ~1-5 KB per job (depends on result size)
- Auto-expiration prevents growth
- 1000 jobs ≈ 1-5 MB

**Cache Storage:**
- ~10-50 KB per cached result
- 24-hour TTL
- 1000 cached results ≈ 10-50 MB

**Total:**
- Typical deployment: < 100 MB
- High volume: < 1 GB
- Redis handles efficiently

## Scalability

### Current Limitations

**Single Instance:**
- No clustering
- No replication
- Single point of failure

**Memory Bound:**
- All data in RAM
- Limited by server memory
- TTL helps but not perfect

### Future Improvements

**Redis Cluster:**
- Horizontal scaling
- Sharding across nodes
- High availability

**Persistence:**
- RDB snapshots
- AOF (Append Only File)
- Durability guarantees

**Replication:**
- Master-replica setup
- Read scaling
- Failover support

## Monitoring

### Key Metrics

**Memory Usage:**
- `INFO memory` - Total memory
- `INFO keyspace` - Key counts
- Monitor for growth

**Operations:**
- `INFO stats` - Command statistics
- Track SET/GET operations
- Monitor error rates

**TTL:**
- Track expiring keys
- Monitor cache hit rate
- Job completion rate

### Redis CLI Commands

**Inspect Jobs:**
```bash
redis-cli KEYS "job:*"
redis-cli GET "job:abc123"
redis-cli TTL "job:abc123"
```

**Inspect Cache:**
```bash
redis-cli KEYS "cache:*"
redis-cli GET "cache:sha256hash"
```

**Memory Info:**
```bash
redis-cli INFO memory
redis-cli INFO keyspace
```

**Stats:**
```bash
redis-cli INFO stats
```

## Backup & Recovery

### Current State

**No Persistence:**
- Data lost on restart
- Acceptable for current use case (jobs expire quickly)
- Cache can be regenerated

### Recommended

**RDB Snapshots:**
- Periodic snapshots
- Save to disk
- Restore on restart

**AOF:**
- Append-only file
- Every write logged
- Better durability

## Security

### Network Security

**Docker:**
- Redis only accessible within Docker network
- Not exposed to public internet
- Internal service communication

### Authentication

**Current:**
- No password (internal network)
- Acceptable for containerized deployment

**Production:**
- Add Redis password
- Use AUTH command
- Restrict network access

## Troubleshooting

### Common Issues

**Connection Refused:**
- Check Redis is running
- Verify REDIS_URL
- Check Docker network

**Key Not Found:**
- Job expired (TTL reached)
- Wrong job_id
- Key format mismatch

**Memory Issues:**
- Too many jobs/cache entries
- Increase TTL expiration
- Add memory limits
- Monitor with `INFO memory`

**Slow Operations:**
- Check Redis performance
- Monitor connection count
- Check for blocking operations

### Debugging

**Enable Logging:**
- Set `LOG_LEVEL=DEBUG`
- See Redis operations in logs

**Redis CLI:**
```bash
docker exec -it faultline-redis redis-cli
# Then run commands
```

**Monitor Commands:**
```bash
redis-cli MONITOR  # See all commands in real-time
```

## Best Practices

### Key Naming

- Use prefixes (`job:`, `cache:`)
- Consistent format
- Easy to scan/delete

### TTL Management

- Set appropriate expiration
- Don't set too long (waste memory)
- Don't set too short (premature expiration)

### Error Handling

- Always check for None
- Handle JSON parsing errors
- Log failures

### Performance

- Use pipelining for bulk operations
- Avoid blocking commands
- Monitor memory usage

## Future Enhancements

### Job Queue

- Use Redis Lists for queuing
- Priority queues
- Delayed jobs

### Pub/Sub

- Real-time job updates
- WebSocket integration
- Event notifications

### Lua Scripts

- Atomic operations
- Complex logic in Redis
- Better performance

### Streams

- Job event log
- Audit trail
- Replay capability


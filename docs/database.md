# Database

This document describes the Redis caching system used by the Property Matching System.

## Overview

The Property Matching System uses Redis as a caching layer to store and retrieve the results of LLM property comparisons. This caching approach significantly reduces API costs and improves performance by avoiding redundant API calls for the same property pairs.

## Redis Configuration

Redis connection is configured through the `REDIS_URL` environment variable. The default value is:

```
REDIS_URL=redis://localhost:6379
```

This can be changed to point to a remote Redis instance if needed.

## Cache Structure

### Key Format

Redis keys follow this format:

```
match:{list1Description}:{list2Description}
```

Where:
- `{list1Description}` is the description of a property from List 1
- `{list2Description}` is the description of a property from List 2

### Value Format

Values are stored as JSON strings representing a `MatchResult` object:

```json
{
  "match": boolean,
  "details": string,
  "confidencePercentage": number
}
```

Example:
```json
{
  "match": true,
  "details": "85% confidence: Both properties describe downtown office spaces in the same location",
  "confidencePercentage": 85
}
```

## Caching Flow

1. **Check Cache**: Before making an API call, the system checks if the property pair has already been compared:
   ```typescript
   const cacheKey = `match:${list1Desc}:${list2Desc}`;
   const cachedResult = await redisClient.get(cacheKey);
   ```

2. **Use Cached Results**: If a result exists in the cache, it's used directly:
   ```typescript
   if (cachedResult) {
     return JSON.parse(cachedResult);
   }
   ```

3. **Store New Results**: After getting a result from the API, it's stored in the cache:
   ```typescript
   redisClient.set(`match:${list1Desc}:${list2Desc}`, JSON.stringify(result));
   ```

## Batch Operations

For efficiency, the system uses Redis batch operations to check for multiple cache entries at once:

```typescript
const cacheKeys = candidates.map((c: Property) => `match:${desc}:${c.description}`);
const cachedResults = await redisClient.mGet(cacheKeys);
```

## Implementation Details

### Redis Client Initialization

The Redis client is initialized in both the main process (`src/index.ts`) and each worker thread (`src/worker.ts`):

```typescript
const redisClient = createClient({ url: CONFIG.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error:', err));
await redisClient.connect();
```

### Error Handling

The system continues functioning even if Redis is unavailable or experiencing issues:

1. **Connection Errors**: Redis connection errors are logged but don't halt the process
2. **Failed Redis Operations**: If a Redis operation fails, the system falls back to using the API

### Client Cleanup

Redis connections are properly closed when the process completes:

```typescript
await redisClient.quit();
```

## Persistence Considerations

By default, Redis uses in-memory storage, which means cached results will be lost if Redis restarts. For more persistent caching:

1. **Enable Redis Persistence**: Configure Redis with RDB or AOF persistence
2. **Use Redis Cluster**: For high availability setups

## Cache Expiration

Currently, cache entries do not expire. For long-running systems, consider implementing TTL (Time To Live) for cache entries:

```typescript
// Example of setting a cache entry with a 1-day expiration
redisClient.set(`match:${list1Desc}:${list2Desc}`, JSON.stringify(result), {
  EX: 86400 // 24 hours in seconds
});
```

## Memory Management

For large-scale deployments with many property comparisons, monitor Redis memory usage and consider:

1. **Periodic Cache Cleanup**: Implementing a script to clear old or less valuable cache entries
2. **Memory Limits**: Setting appropriate `maxmemory` settings in Redis configuration
3. **Eviction Policies**: Using appropriate eviction policies like `volatile-lru` or `allkeys-lru` 
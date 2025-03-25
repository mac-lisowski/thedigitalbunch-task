# Features

This document details the key features of the Property Matching System.

## Core Features

### 1. Dual-Stage Property Matching

The system uses a two-stage approach to identify matching properties:

#### Exact Text Matching

- **Description**: Identifies properties with identical descriptions after normalization (case folding, whitespace normalization)
- **Benefit**: Fast and precise matching without API costs
- **Implementation**: The `isExactMatch()` function normalizes descriptions and compares them directly

#### Semantic Matching via LLM

- **Description**: Uses OpenAI's API to determine if non-identical descriptions refer to the same property
- **Benefits**: 
  - Can identify matches despite different wording
  - Understands property types and locations contextually
- **Implementation**: Detailed prompt engineering guides the LLM to evaluate property similarity

### 2. Parallel Processing

- **Description**: Distributes work across multiple worker threads
- **Benefits**:
  - Significantly faster processing
  - Efficient use of system resources
- **Implementation**: Node.js Worker Threads API with configurable worker count

### 3. Efficient Data Loading

- **Description**: Uses streaming to load and parse large JSON files
- **Benefits**:
  - Handles files of any size
  - Minimal memory footprint
- **Implementation**: Stream-based JSON parsing with `stream-json`

### 4. Result Caching

- **Description**: Caches LLM comparison results in Redis
- **Benefits**:
  - Avoids redundant API calls
  - Significant cost savings for repeated comparisons
  - Faster processing for previously seen comparisons
- **Implementation**: Redis key-value store with property pair keys

### 5. Smart Batching

- **Description**: Combines multiple property comparisons in single API requests
- **Benefits**:
  - Reduced API call overhead
  - Faster overall processing
- **Implementation**: Configurable batch sizes with the `LLM_BATCH_SIZE` setting

### 6. Confidence-Based Matching

- **Description**: Categorizes matches based on confidence levels
- **Categories**:
  - **Full Match** (80-100% confidence)
  - **Similar Match** (45-79% confidence)
  - **Mismatch** (0-44% confidence)
- **Implementation**: The `getMatchStatus()` function converts percentages to match status

### 7. Comprehensive Reporting

- **Description**: Generates detailed CSV reports of all comparisons
- **Report Content**:
  - List 1 and List 2 property descriptions
  - Match status (Match, Similar Match, Mismatch)
  - Confidence percentage
  - Explanations for matches/mismatches
  - Property limit and mortgage amount comparisons
- **Implementation**: Uses `csv-writer` for efficient report generation

### 8. Test Data Generation

- **Description**: Built-in utility for generating test property data
- **Benefits**:
  - Facilitates development and testing
  - Creates realistic property descriptions
  - Configurable match percentages
- **Implementation**: The `generate-test-data.ts` script

## Advanced Features

### 1. Graceful Error Handling

- **Description**: Robust handling of various failure scenarios
- **Covered Scenarios**:
  - API timeouts or failures
  - Worker thread crashes
  - Redis connection issues
  - Malformed input data
- **Implementation**: Try-catch blocks and fallback mechanisms

### 2. Debugging Support

- **Description**: Comprehensive logging for troubleshooting
- **Benefits**:
  - Visibility into matching decisions
  - Easier identification of issues
- **Implementation**: Conditional logging controlled by the `DEBUG` environment variable

### 3. Configurable Matching Parameters

- **Description**: Adjustable settings for matching thresholds and criteria
- **Configurable Elements**:
  - Confidence thresholds for match categories
  - Batch sizes for API calls
  - Number of worker threads
- **Implementation**: Environment variable-based configuration

### 4. Environment-Based Configuration

- **Description**: Different configurations for development vs. production
- **Benefits**:
  - Simplified deployment across environments
  - Environment-specific optimizations
- **Implementation**: dotenv for environment variable management 
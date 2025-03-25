# System Architecture

This document describes the architecture of the Property Matching System.

## Overview

The Property Matching System is designed to efficiently compare properties from two different lists to determine if they represent the same underlying property. The system follows a parallel processing architecture with caching to optimize performance and reduce API costs.

## Architecture Diagram

```
┌─────────────────┐      ┌─────────────────┐
│    List 1 JSON  │      │    List 2 JSON  │
└────────┬────────┘      └────────┬────────┘
         │                        │
         v                        v
┌─────────────────────────────────────────┐
│           JSON Stream Loader            │
└────────────────────┬────────────────────┘
                     │
                     v
┌─────────────────────────────────────────┐
│              Main Process               │
│                                         │
│      ┌─────────────────────────────┐    │
│      │     Worker Distribution     │    │
└──────┴──────────┬──────────────────┘    │
                  │                       │
    ┌─────────────┼─────────────┐         │
    │             │             │         │
┌───v───┐     ┌───v───┐     ┌───v───┐     │
│Worker1│     │Worker2│     │Worker3│     │
└───┬───┘     └───┬───┘     └───┬───┘     │
    │             │             │         │
    └─────────────┼─────────────┘         │
                  │                       │
┌─────────────────v─────────────────────┐ │
│         Results Collection            │ │
└─────────────────┬─────────────────────┘ │
                  │                       │
┌─────────────────v─────────────────────┐ │
│           Report Generation           │ │
└─────────────────────────────────────────┘
                  │
                  v
┌─────────────────────────────────────────┐
│              report.csv                 │
└─────────────────────────────────────────┘
```

## Component Details

### 1. JSON Stream Loader (`src/utils/load-json-stream.ts`)

- **Purpose**: Efficiently loads large JSON files containing property data
- **Approach**: Uses streaming to handle large files without excessive memory usage
- **Implementation**: Leverages `stream-json` for efficient JSON parsing

### 2. Main Process (`src/index.ts`)

- **Purpose**: Orchestrates the overall matching process
- **Functionality**:
  - Loads property data from both lists
  - Creates worker threads for parallel processing
  - Collects results from workers
  - Generates the final report

### 3. Worker System (`src/worker.ts`)

- **Purpose**: Performs the actual comparison between properties
- **Components**:
  - **Exact Matching**: Identifies identical properties through text normalization
  - **LLM Integration**: Uses OpenAI API for semantic matching of non-identical descriptions
  - **Redis Caching**: Caches comparison results to avoid redundant API calls
  - **Batch Processing**: Optimizes API calls by batching comparisons

### 4. Configuration System (`src/config.ts`)

- **Purpose**: Centralizes configuration settings
- **Implementation**: Reads settings from environment variables with sensible defaults

### 5. Type Definitions (`src/types.ts`)

- **Purpose**: Defines TypeScript interfaces and types for the system
- **Key Types**:
  - `Property`: Definition of a property object
  - `MatchStatus`: Enum for match status outcomes
  - `ReportEntry`: Structure for report entries
  - `BatchComparisonRequest`: Configuration for batch processing

## Process Flow

1. **Data Loading**:
   - Load property data from List 1 and List 2 JSON files
   - Parse property objects with descriptions, limits, and mortgage amounts

2. **Work Distribution**:
   - Divide List 1 items among worker threads based on `NUM_WORKERS` setting
   - Each worker gets a subset of List 1 and the complete List 2

3. **Property Matching**:
   - **Phase 1: Exact Matching**
     - Workers identify exact matches through normalized text comparison
     - Matched properties are marked and added to the report
   
   - **Phase 2: LLM Semantic Matching**
     - Non-exact matches are processed through the OpenAI API
     - Candidates are batched for efficient API usage
     - Redis caching prevents redundant API calls for the same property pairs

4. **Result Aggregation**:
   - Workers return their results to the main process
   - Results include matched properties and report entries

5. **Report Generation**:
   - All results are combined into a single report
   - The report is written to a CSV file

## Optimization Strategies

1. **Parallel Processing**: Multiple worker threads process different subsets of List 1
2. **Batch Processing**: Multiple comparisons are combined in single API calls
3. **Result Caching**: Redis cache prevents redundant API calls
4. **Stream Processing**: JSON data is streamed to handle large files
5. **Early Matching**: Exact matches are identified before using the API

## Error Handling

The system implements robust error handling at multiple levels:

1. **API Failures**: Gracefully handles API timeouts and errors
2. **Redis Failures**: Continues operation even if Redis is unavailable
3. **Worker Crashes**: Reports partial results if a worker fails
4. **Input Errors**: Validates input data before processing 
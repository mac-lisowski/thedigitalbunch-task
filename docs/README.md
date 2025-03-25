# Property Matching System Documentation

This directory contains the documentation for the Property Matching System, which compares descriptions and attributes of properties from two different lists to identify matches.

## Documentation Structure

- [Getting Started](./getting-started.md) - Instructions for setting up and running the system
- [Architecture](./architecture.md) - Overview of the system's architecture and components
- [Features](./features.md) - Detailed descriptions of the system's features
- [API Reference](./api-reference.md) - API documentation for developers
- [Database](./database.md) - Information about the Redis cache and data persistence
- [Testing](./testing.md) - Testing methodologies and instructions
- [Changelog](./changelog/README.md) - History of changes to the system

## Overview

The Property Matching System compares property descriptions from two different lists (List1 and List2) to determine if they refer to the same physical property. The system uses a combination of exact text matching and large language model (LLM) powered semantic matching to achieve high accuracy.

### Key Components

1. **Worker System**: Distributes comparison work across multiple worker threads for parallel processing
2. **Exact Matching**: First identifies exact matches based on normalized text
3. **LLM Matching**: Uses OpenAI's API to determine if non-exact descriptions refer to the same property
4. **Redis Caching**: Caches LLM comparison results to improve performance and reduce API costs
5. **Reporting**: Generates a detailed CSV report of all matches and mismatches

### Workflow

1. The system loads property data from two JSON files
2. It divides the work among multiple worker threads
3. Each worker identifies exact matches first
4. Remaining property pairs are sent to the LLM for semantic comparison
5. Results are compiled into a comprehensive CSV report

## Configuration

The system is configured using environment variables defined in the `.env` file. See the [Getting Started](./getting-started.md) documentation for details on available configuration options. 
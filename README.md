# The Digital Bunch - LLM Data Processing Task

## Overview
A Node.js application for processing data using Large Language Models (LLM).

## Prerequisites
- Node.js 22 or higher
- Docker
- OpenAI API key

## Assumptions

- It will always spin up 4 thread workers.
- Chosen LLM model `gpt-4o-mini` assuming that minor accuracy trade-offs in edge cases are acceptable due to the cost efficency which in production environment where millions of entries would be proccessed might be important - if not switch model in the code to `gpt-4o` 

### What could be upgraded? 
For production environment it would be wise to upgrade script to respect rate limits from headers which we are receiving from OpenAI API.


## Getting Started

### 1. Start the Redis
Launch Redis using Docker Compose:
```bash
docker compose up -d
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Project
```bash
npm run build
```

## Usage

### Process Data
Run the main application:
```bash
npm start
```

### Generate Test Data
Generate custom test datasets:
```bash
# Generate data with specified number of entries per file
npm run generate-data -- -c <count>
```

Where `<count>` is the number of entries in each file (defaults to 1000).

## Configuration
The application requires proper environment configuration to work correctly. See `.env.tpl` for required variables.

## License
This project is licensed under the MIT License.

---
Author: Maciej Lisowski

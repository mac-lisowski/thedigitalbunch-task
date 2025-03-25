# Getting Started

This guide will help you set up and run the Property Matching System.

## Prerequisites

- Node.js v18+ 
- npm or yarn
- Redis server (for caching)
- OpenAI API key

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd property-matching-system
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the template:
   ```bash
   cp .env.tpl .env
   ```

4. Edit the `.env` file and add your OpenAI API key and adjust other settings as needed.

## Configuration Options

The system is configured through environment variables defined in the `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Connection URL for Redis | `redis://localhost:6379` |
| `BATCH_SIZE` | Number of items to process in each batch | `1000` |
| `LLM_BATCH_SIZE` | Maximum items in a single LLM API call | `10` |
| `NUM_WORKERS` | Number of worker threads | `4` |
| `NODE_ENV` | Application environment | `development` |
| `OPENAI_API_KEY` | Your OpenAI API key | (Required) |
| `MODEL` | OpenAI model to use | `gpt-4o-mini` |
| `DEBUG` | Enable verbose logging | `false` |

## Running the System

### Generating Test Data

To generate test data for development and testing:

```bash
npm run generate-data
```

You can specify the number of entries to generate:

```bash
npm run generate-data -- --count 500
```

This will create two JSON files in the `src/data` directory:
- `list1.json` - First list of properties
- `list2.json` - Second list of properties with some matching entries

### Running the Matching Process

To run the property matching process:

```bash
npm start
```

If you want to enable debug logging:

```bash
DEBUG=true npm start
```

### Output

The system will generate a `report.csv` file in the root directory containing:
- List 1 Description
- List 2 Description
- Match Status (Match, Similar Match, or Mismatch)
- Details (including confidence percentage and explanation)

## Example Usage

Here's a complete example of running the system with test data:

```bash
# Generate 100 test properties
npm run generate-data -- --count 100

# Run the matching process with debug logging
DEBUG=true npm start

# Check the results
cat report.csv
```

## Troubleshooting

If you encounter issues:

1. Verify your OpenAI API key is correct in the `.env` file
2. Check that Redis is running and accessible
3. Enable debugging with `DEBUG=true` for more verbose output
4. Review the error messages for specific issues 
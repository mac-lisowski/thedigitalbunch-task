# Redis Configuration
# Connection URL for Redis cache
REDIS_URL=redis://localhost:6379

# Batch Processing Configuration
# Number of items from list1 to process in each batch
BATCH_SIZE=1000
# Maximum number of items to process in a single LLM API call
LLM_BATCH_SIZE=10
# Number of worker threads to use for parallel processing
NUM_WORKERS=4

# Application Environment
NODE_ENV=development

# OpenAI API Configuration
# Your OpenAI API key - required for property matching functionality
OPENAI_API_KEY=sk-YOUR_API_KEY_HERE
# OpenAI model to use for property matching
MODEL=gpt-4o-mini

# Debug Configuration
# Set to 'true' to enable verbose logging, 'false' for production use
DEBUG=false
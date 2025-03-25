import { config } from 'dotenv';

config();

export const CONFIG = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '1000', 10),
    LLM_BATCH_SIZE: parseInt(process.env.LLM_BATCH_SIZE || '10', 10),
    NUM_WORKERS: parseInt(process.env.NUM_WORKERS || String(Math.min(require('os').cpus().length, 4)), 10),
    MODEL: process.env.MODEL || 'gpt-4o-mini',
    DEBUG: process.env.DEBUG === 'true',
};
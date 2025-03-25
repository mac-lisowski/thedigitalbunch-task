import { parentPort, workerData } from 'worker_threads';
import { OpenAI } from 'openai';
import { createClient } from 'redis';
import { CONFIG } from './config.js';
import type { Property, ReportEntry, WorkerResult, MatchResult } from './types.js';
import { MatchStatus } from './types.js';

// Redis client for worker
const redisClient = createClient({ url: CONFIG.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error:', err));
await redisClient.connect();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: CONFIG.OPENAI_API_KEY,
});

// Normalize monetary values
function normalizeMoney(value: string): number {
    if (!value) return 0;
    const str = value.toLowerCase().replace(/[^0-9km]/g, '');
    if (str.includes('m')) return parseFloat(str.replace('m', '')) * 1000000;
    if (str.includes('k')) return parseFloat(str.replace('k', '')) * 1000;
    return parseFloat(str);
}

// Fuzzy matching with GPT-4o-mini (batched)
async function isComparableBatch(pairs: [string, string][]): Promise<MatchResult[]> {
    const cacheKeys = pairs.map(([desc1, desc2]) => `match:${desc1}:${desc2}`);
    const cachedResults = await redisClient.mGet(cacheKeys);
    const uncachedPairs: [string, string][] = [];
    const results: MatchResult[] = [];

    // Check cache first
    pairs.forEach(([desc1, desc2], i) => {
        if (cachedResults[i]) {
            results.push(JSON.parse(cachedResults[i] as string));
        } else {
            uncachedPairs.push([desc1, desc2]);
            results.push(null as any);
        }
    });

    if (uncachedPairs.length === 0) return results;

    // Build prompt for uncached pairs
    const prompt = uncachedPairs
        .map(([desc1, desc2], i) => `${i + 1}. Are '${desc1}' and '${desc2}' describing the same property? Respond with 'yes' or 'no' and a brief explanation.`)
        .join('\n') + '\n\nFormat your response as a numbered list matching the input order.';

    try {
        const response = await openai.chat.completions.create({
            model: CONFIG.MODEL, // GPT-4o-mini
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.5,
        });

        console.log(`Response received from OpenAI API`);

        const text = response.choices[0].message.content || '';
        const lines = text.split('\n').filter((line: string) => line.match(/^\d+\./));
        const newResults = lines.map((line: string) => {
            const match = line.toLowerCase().includes('yes');
            const details = line.split('. ')[1] || 'No explanation provided';
            return { match, details };
        });

        // Cache new results
        const cacheData: [string, string][] = uncachedPairs.map(([desc1, desc2], i) => [
            `match:${desc1}:${desc2}`,
            JSON.stringify(newResults[i]),
        ]);
        await redisClient.mSet(cacheData);

        // Merge cached and new results
        let newIdx = 0;
        return results.map((r) => (r === null ? newResults[newIdx++] : r));
    } catch (error) {
        console.error(`API error: ${(error as Error).message}`);
        return uncachedPairs.map(() => ({ match: false, details: 'Error during matching' }));
    }
}

// Process a batch of list1
async function processBatch(list1: Property[], list2: Property[]): Promise<WorkerResult> {
    const report: ReportEntry[] = [];
    const matchedPolicies: number[] = [];

    console.log(`list1: `, list1)
    console.log(`list2: `, list2)
    for (let i = 0; i < list1.length; i += CONFIG.LLM_BATCH_SIZE) {
        const list1Batch = list1.slice(i, i + CONFIG.LLM_BATCH_SIZE);
        const pairs: [string, string][] = list1Batch.map((list1) => {
            const candidates = list2
                .filter((p, idx) => !matchedPolicies.includes(idx))
                .map((p) => [list1.description, p.description] as [string, string]);
            return candidates[0] || [list1.description, ''];
        });

        const results = await isComparableBatch(pairs);

        list1Batch.forEach((list1, j) => {
            const { match, details } = results[j];
            const policy = match && pairs[j][1]
                ? list2.find((p, idx) => p.description === pairs[j][1] && !matchedPolicies.includes(idx))
                : null;

            if (policy) {
                const limit1 = normalizeMoney(list1.limit);
                const limit2 = normalizeMoney(policy.limit);
                const mort1 = normalizeMoney(list1.mortgageAmount);
                const mort2 = normalizeMoney(policy.mortgageAmount);
                const status = limit1 === limit2 && mort1 === mort2 ? MatchStatus.MATCH : MatchStatus.SIMILAR_MATCH;
                report.push({
                    list1Desc: list1.description,
                    list2Desc: policy.description,
                    status,
                    details: `${details} Limits: ${list1.limit}/${policy.limit}, Mortgages: ${list1.mortgageAmount}/${policy.mortgageAmount}`,
                });
                matchedPolicies.push(list2.indexOf(policy));
            } else {
                report.push({
                    list1Desc: list1.description,
                    list2Desc: '',
                    status: MatchStatus.MISMATCH,
                    details: 'No corresponding property found',
                });
            }
        });
    }

    return { report, matchedPolicies };
}

// Worker logic
const { list1, list2, batchStart, batchStep } = workerData as {
    list1: Property[];
    list2: Property[];
    batchStart: number;
    batchStep: number;
};

const workerList1: Property[] = [];

for (let i = batchStart; i < list1.length; i += batchStep) {
    workerList1.push(list1[i]);
}

(async () => {
    const result = await processBatch(workerList1, list2);
    parentPort!.postMessage(result);
    await redisClient.quit();
})();
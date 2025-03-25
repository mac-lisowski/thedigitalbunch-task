import { parentPort, workerData } from 'worker_threads';
import { OpenAI } from 'openai';
import { createClient } from 'redis';
import { CONFIG } from './config.js';
import type { Property, ReportEntry, WorkerResult, MatchResult, BatchComparisonRequest } from './types.js';
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

// Simple keyword-based pre-filtering
function getKeywords(description: string): string[] {
    return description.toLowerCase().split(/[\s-]+/).filter((w) => w.length > 3);
}

function preFilterList2(list1Desc: string, list2Items: Property[]): Property[] {
    const list1Keywords = new Set(getKeywords(list1Desc));
    return list2Items.filter((item) => {
        const itemKeywords = getKeywords(item.description);
        return itemKeywords.some((kw) => list1Keywords.has(kw));
    });
}

// Function to determine match status based on confidence percentage
function getMatchStatus(confidencePercentage: number): MatchStatus {
    if (confidencePercentage >= 80) {
        return MatchStatus.MATCH;
    } else if (confidencePercentage >= 45) {
        return MatchStatus.SIMILAR_MATCH;
    } else {
        return MatchStatus.MISMATCH;
    }
}

/**
 * Determines if two descriptions should be considered an exact match
 * by normalizing and comparing them.
 */
function isExactMatch(desc1: string, desc2: string): boolean {
    // Normalize descriptions for comparison - only basic normalization without assumptions about content
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    return normalize(desc1) === normalize(desc2);
}

// Group comparison requests into optimal batches for API efficiency
function createComparisonBatches(
    list1Batch: Property[],
    list2Items: Property[],
    excludedIndices: number[]
): BatchComparisonRequest[] {
    // Pre-filter list2 items for each list1 item
    const batches: BatchComparisonRequest[] = [];
    const batchSize = CONFIG.LLM_BATCH_SIZE;

    // Create batches with list1 items and their potential matches from list2
    for (let i = 0; i < list1Batch.length; i += batchSize) {
        const currentList1Batch = list1Batch.slice(i, i + batchSize);

        // For each list1 item, find exact matches and non-exact candidates
        const list2Candidates = new Map<string, Property[]>();
        const exactMatches = new Map<string, Property[]>();

        currentList1Batch.forEach(list1Item => {
            const candidatesList: Property[] = [];
            const exactMatchesList: Property[] = [];

            // Filter out excluded indices (already matched items)
            const availableList2 = list2Items.filter((_, idx) => !excludedIndices.includes(idx));

            // Check each list2 item
            for (const list2Item of availableList2) {
                // Check for exact match
                if (isExactMatch(list1Item.description, list2Item.description)) {
                    exactMatchesList.push(list2Item);
                } else {
                    // If not an exact match, it's a candidate for LLM matching
                    candidatesList.push(list2Item);
                }
            }

            // Store the results
            exactMatches.set(list1Item.description, exactMatchesList);

            // Always include all available candidates (up to a reasonable limit)
            // to ensure we don't miss potential matches due to domain-specific filtering
            list2Candidates.set(list1Item.description, candidatesList.slice(0, 20));
        });

        batches.push({
            list1Items: currentList1Batch,
            list2Candidates,
            exactMatches
        });
    }

    if (process.env.DEBUG === 'true') {
        console.log(`Created ${batches.length} batches for processing`);
        console.log(`First batch list1Items count: ${batches[0].list1Items.length}`);
        console.log(`First batch LLM items count: ${batches[0].list2Candidates.size}`);
        console.log(`First batch exactMatches count: ${batches[0].exactMatches ? Object.keys(batches[0].exactMatches).length : 0}`);
    }

    return batches;
}

// Bullet-proof batch comparison with OpenAI
async function batchCompare(batch: BatchComparisonRequest): Promise<Map<string, MatchResult[]>> {
    const list1Descriptions = batch.list1Items.map((item: Property) => item.description);
    const resultMap = new Map<string, MatchResult[]>();

    // Check cache first for each list1 item
    const cacheChecks = await Promise.all(
        list1Descriptions.map(async (desc: string) => {
            const candidates = batch.list2Candidates.get(desc) || [];
            const cacheKeys = candidates.map((c: Property) => `match:${desc}:${c.description}`);

            // Handle empty candidates case
            let cachedResults: (string | null)[] = [];
            if (cacheKeys.length > 0) {
                cachedResults = await redisClient.mGet(cacheKeys);
            }

            const uncachedPairs: [string, string][] = [];
            const results: MatchResult[] = [];

            candidates.forEach((candidate: Property, i: number) => {
                if (cachedResults[i]) {
                    results.push(JSON.parse(cachedResults[i] as string));
                } else {
                    uncachedPairs.push([desc, candidate.description]);
                    results.push(null as any);
                }
            });

            return {
                list1Desc: desc,
                results,
                uncachedPairs,
                candidates
            };
        })
    );

    // Filter out items that are fully cached
    const itemsNeedingApi = cacheChecks.filter(item => item.uncachedPairs.length > 0);

    // If all items are cached, return results directly
    if (itemsNeedingApi.length === 0) {
        cacheChecks.forEach(check => {
            resultMap.set(check.list1Desc, check.results);
        });
        return resultMap;
    }

    // Build prompt for items needing API call
    const prompt = `Compare the following property descriptions and determine if they describe the same property.
For each comparison, provide:
1. A match percentage between 0-100% indicating how similar the properties are
2. A brief explanation for your reasoning

Use these guidelines for match percentages:
- 80-100%: Properties are clearly the same (full match)
- 45-79%: Properties are somewhat similar (similar match)
- 0-44%: Properties are different (mismatch)

IMPORTANT MATCHING RULES:
- Properties that serve the same function should be rated at least 60% similar
- Properties in the same location with similar purposes should be rated at least 70% similar
- Look beyond exact wording - focus on property function, location, and purpose
- Properties with the same general category must be rated at least 45% similar
- Give higher percentages to properties that share both location and purpose

Comparisons:
${itemsNeedingApi
            .map((item, i) => {
                const list1Desc = item.list1Desc;
                return item.uncachedPairs.map(([_, list2Desc], j) =>
                    `Item ${i + 1}.${j + 1}: 
Property A: "${list1Desc}"
Property B: "${list2Desc}"`
                ).join('\n\n');
            })
            .join('\n\n')}`;

    try {
        // Make a single API call for all uncached comparisons
        const response = await openai.chat.completions.create({
            model: CONFIG.MODEL,
            messages: [{
                role: 'user',
                content: prompt + '\n\nFormat your responses as "Item X.Y: Z%. [Explanation]" following the numbering scheme above.'
            }],
            max_tokens: 2000,
            temperature: 0.5,
        });

        const text = response.choices[0].message.content || '';
        const lines = text.split('\n').filter(line => /Item \d+\.\d+:/.test(line));

        // Build a map of results from the API
        const apiResults = new Map<string, Map<string, MatchResult>>();

        lines.forEach(line => {
            // First try to match the standard format we requested: "Item X.Y: Z%. [Explanation]"
            let match = line.match(/Item (\d+)\.(\d+):\s*(\d+(?:\.\d+)?)%\.?\s*(.*)/i);

            // If that doesn't work, try a more flexible pattern to extract the percentage from anywhere in the line
            if (!match) {
                match = line.match(/Item (\d+)\.(\d+):[^]*?(\d+(?:\.\d+)?)%/i);
            }

            if (match) {
                const [_, itemIdx, subItemIdx, confidenceStr] = match;
                const i = parseInt(itemIdx) - 1;
                const j = parseInt(subItemIdx) - 1;

                if (i < itemsNeedingApi.length && j < itemsNeedingApi[i].uncachedPairs.length) {
                    const [list1Desc, list2Desc] = itemsNeedingApi[i].uncachedPairs[j];
                    const confidencePercentage = parseFloat(confidenceStr);
                    const isMatch = confidencePercentage >= 45; // Both MATCH and SIMILAR_MATCH are considered matches

                    // Get the explanation (everything after the item identifier)
                    let explanation = '';
                    const explainMatch = line.match(/Item \d+\.\d+:(.*)$/);
                    if (explainMatch) {
                        // Clean up the explanation by removing the percentage and any punctuation after it
                        explanation = explainMatch[1].replace(/\s*\d+(?:\.\d+)?%\.?\s*/, ' ').trim();
                    }

                    const result: MatchResult = {
                        match: isMatch,
                        details: `${confidencePercentage}% confidence: ${explanation}`,
                        confidencePercentage
                    };

                    // Initialize nested map if needed
                    if (!apiResults.has(list1Desc)) {
                        apiResults.set(list1Desc, new Map());
                    }
                    apiResults.get(list1Desc)!.set(list2Desc, result);

                    // Cache the result
                    redisClient.set(`match:${list1Desc}:${list2Desc}`, JSON.stringify(result));

                    // Debug log to see what we extracted
                    if (process.env.DEBUG === 'true') {
                        console.log(`Parsed match: Item ${itemIdx}.${subItemIdx}, confidence: ${confidencePercentage}%, desc: "${list1Desc}" vs "${list2Desc}"`);
                    }
                }
            } else if (process.env.DEBUG === 'true') {
                console.log(`Failed to parse line: ${line}`);
            }
        });

        // Merge API results with cached results
        cacheChecks.forEach(check => {
            const list1Desc = check.list1Desc;
            const mergedResults: MatchResult[] = [];

            check.candidates.forEach((candidate, i) => {
                if (check.results[i]) {
                    // Use cached result
                    mergedResults.push(check.results[i]);
                } else {
                    // Use API result if available
                    const apiResultMap = apiResults.get(list1Desc);
                    if (apiResultMap && apiResultMap.has(candidate.description)) {
                        mergedResults.push(apiResultMap.get(candidate.description)!);
                    } else {
                        // Fallback if no result found
                        mergedResults.push({
                            match: false,
                            details: 'No comparison result available'
                        });
                    }
                }
            });

            resultMap.set(list1Desc, mergedResults);
        });

        return resultMap;

    } catch (error) {
        console.error(`API error: ${(error as Error).message}`);

        // Handle API failure gracefully - return empty results
        cacheChecks.forEach(check => {
            const list1Desc = check.list1Desc;
            const errorResults = check.candidates.map(() => ({
                match: false,
                details: 'Error during API comparison: ' + (error as Error).message
            }));
            resultMap.set(list1Desc, errorResults);
        });

        return resultMap;
    }
}

// Process a batch of list1 items
async function processBatch(list1: Property[], list2: Property[]): Promise<WorkerResult> {
    const report: ReportEntry[] = [];
    const matchedPolicies: number[] = [];

    // Process list1 items in chunks for efficient API batching
    for (let i = 0; i < list1.length; i += CONFIG.BATCH_SIZE) {
        const list1Chunk = list1.slice(i, i + CONFIG.BATCH_SIZE);

        // Create optimized batches for API calls
        const comparisonBatches = createComparisonBatches(
            list1Chunk,
            list2,
            matchedPolicies
        );

        // Process each batch with a single API call when possible
        for (const batch of comparisonBatches) {
            // First process exact matches
            batch.list1Items.forEach(list1Item => {
                const list1Desc = list1Item.description;
                const exactMatchItems = batch.exactMatches.get(list1Desc) || [];

                if (exactMatchItems.length > 0) {
                    // We have an exact match
                    const matchedItem = exactMatchItems[0]; // Take the first exact match

                    report.push({
                        list1Desc: list1Item.description,
                        list2Desc: matchedItem.description,
                        status: MatchStatus.MATCH,
                        details: `100% confidence: Exact text match. Limits: ${list1Item.limit}/${matchedItem.limit}, Mortgages: ${list1Item.mortgageAmount}/${matchedItem.mortgageAmount}`,
                    });

                    // Record that we've matched this list2 item
                    const list2Idx = list2.findIndex(item => isExactMatch(item.description, matchedItem.description));
                    if (list2Idx >= 0 && !matchedPolicies.includes(list2Idx)) {
                        matchedPolicies.push(list2Idx);
                    }

                    // Remove from candidates to avoid processing again
                    batch.list2Candidates.delete(list1Desc);
                }
            });

            // Skip LLM processing if no candidates left
            if ([...batch.list2Candidates.entries()].every(([_, candidates]) => candidates.length === 0)) {
                continue;
            }

            // Get comparison results for remaining items in the batch
            const batchResults = await batchCompare(batch);

            // Process the results for each list1 item that wasn't an exact match
            batch.list1Items.forEach(list1Item => {
                const list1Desc = list1Item.description;

                // Skip if already processed as exact match
                if (!batch.list2Candidates.has(list1Desc)) {
                    return;
                }

                const matchResults = batchResults.get(list1Desc) || [];
                const list2Candidates = batch.list2Candidates.get(list1Desc) || [];

                // Find the best match if any
                const bestMatchIdx = matchResults.findIndex(result => result?.match);

                if (bestMatchIdx >= 0 && bestMatchIdx < list2Candidates.length) {
                    // We found a match
                    const matchedItem = list2Candidates[bestMatchIdx];
                    const matchResult = matchResults[bestMatchIdx];
                    const matchDetails = matchResult.details;
                    const confidencePercentage = matchResult.confidencePercentage || 0;

                    // Get the match status based on confidence percentage
                    const status = getMatchStatus(confidencePercentage);

                    // Only consider it a match if status is not MISMATCH
                    if (status !== MatchStatus.MISMATCH) {
                        report.push({
                            list1Desc: list1Item.description,
                            list2Desc: matchedItem.description,
                            status,
                            details: `${matchDetails} Limits: ${list1Item.limit}/${matchedItem.limit}, Mortgages: ${list1Item.mortgageAmount}/${matchedItem.mortgageAmount}`,
                        });

                        // Record that we've matched this list2 item
                        const list2Idx = list2.findIndex(item => isExactMatch(item.description, matchedItem.description));
                        if (list2Idx >= 0 && !matchedPolicies.includes(list2Idx)) {
                            matchedPolicies.push(list2Idx);
                        }
                    } else {
                        // It's a match according to LLM but confidence is too low (< 45%)
                        report.push({
                            list1Desc: list1Item.description,
                            list2Desc: matchedItem.description,
                            status: MatchStatus.MISMATCH,
                            details: `No corresponding property found with sufficient confidence. Best match had ${confidencePercentage}% confidence.`,
                        });
                    }
                } else if (list2Candidates.length > 0) {
                    // No match found but we had candidates
                    report.push({
                        list1Desc: list1Item.description,
                        list2Desc: list2Candidates[0].description, // Include best candidate in report
                        status: MatchStatus.MISMATCH,
                        details: 'No corresponding property found with sufficient confidence.',
                    });
                } else {
                    // No candidates at all
                    report.push({
                        list1Desc: list1Item.description,
                        list2Desc: '',
                        status: MatchStatus.MISMATCH,
                        details: 'No potential matches found',
                    });
                }
            });

            // Add detailed logging for exact matches processing
            if (process.env.DEBUG === 'true' && batch.exactMatches) {
                console.log(`Processing ${Object.keys(batch.exactMatches).length} exact matches`);
                for (const [list1Desc, matches] of Object.entries(batch.exactMatches)) {
                    console.log(`Exact matches for "${list1Desc}": ${matches.length} matches`);
                }
            }
        }
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
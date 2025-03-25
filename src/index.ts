import { Worker } from 'worker_threads';
import { createObjectCsvWriter } from 'csv-writer';
import { createClient } from 'redis';
import { CONFIG } from './config.js';
import type { Property, ReportEntry, WorkerResult } from './types.js';
import { MatchStatus } from './types.js';
import { loadJSONStream } from './utils/load-json-stream.js';
import { fileURLToPath } from 'url';
import path from 'path';


const redisClient = createClient({ url: CONFIG.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error:', err));
await redisClient.connect();

// CSV writer setup
const csvWriter = createObjectCsvWriter({
    path: 'report.csv',
    header: [
        { id: 'list1Desc', title: 'List 1 Description' },
        { id: 'list2Desc', title: 'List 2 Description' },
        { id: 'status', title: 'Status' },
        { id: 'details', title: 'Details' },
    ],
});



// Main reconciliation function
async function reconcileLists(list1File: string, list2File: string): Promise<void> {
    console.info('Starting reconciliation process...');

    // Load data from JSON files
    const [list1, list2] = await Promise.all([
        loadJSONStream(list1File),
        loadJSONStream(list2File),
    ]);

    console.log(`list1: `, list1)
    console.log(`list2: `, list2)

    console.info(`Loaded ${list1.length} list1 and ${list2.length} list2`);

    const report: ReportEntry[] = [];
    const matchedPolicies = new Set<Property>();

    // Split quotes into batches
    const batches: Property[][] = [];
    for (let i = 0; i < list1.length; i += CONFIG.BATCH_SIZE) {
        batches.push(list1.slice(i, i + CONFIG.BATCH_SIZE));
    }


    console.log(`CONFIG: `, CONFIG)
    // Worker pool
    const workerPromises: Promise<void>[] = [];
    for (let i = 0; i < CONFIG.NUM_WORKERS; i++) {
        workerPromises.push(
            new Promise((resolve, reject) => {
                const worker = new Worker(new URL('./worker.js', import.meta.url), {
                    workerData: { list1, list2, batchStart: i, batchStep: CONFIG.NUM_WORKERS },
                });
                worker.on('message', (result: WorkerResult) => {
                    report.push(...result.report);
                    result.matchedPolicies.forEach((idx) => matchedPolicies.add(list2[idx]));
                });
                worker.on('error', reject);
                worker.on('exit', () => resolve());
            })
        );
    }

    // Process batches concurrently
    await Promise.all(workerPromises);
    console.info('All batches processed');

    // Handle unmatched policies
    for (let i = 0; i < list2.length; i++) {
        if (!matchedPolicies.has(list2[i])) {
            report.push({
                list1Desc: '',
                list2Desc: list2[i].description,
                status: MatchStatus.MISMATCH,
                details: 'No corresponding property found',
            });
        }
    }

    // Write report to CSV
    await csvWriter.writeRecords(report);
    console.info('Reconciliation complete. Report generated at report.csv');

    // Cleanup Redis connection
    await redisClient.quit();
}

// Run the program
try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const dataDir = path.resolve(__dirname, 'data');

    await reconcileLists(path.resolve(dataDir, 'list1.json'), path.resolve(dataDir, 'list2.json'));
} catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
}
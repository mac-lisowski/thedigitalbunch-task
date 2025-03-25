import { Property } from "../types.js";
import fs from 'fs';
import streamChain from 'stream-chain';
import streamJson from 'stream-json';
import streamArray from 'stream-json/streamers/StreamArray.js';

export async function loadJSONStream(filePath: string): Promise<Property[]> {
    return new Promise((resolve, reject) => {
        const items: Property[] = [];

        // Create a read stream with reasonable chunk size
        const readStream = fs.createReadStream(filePath, {
            encoding: 'utf8',
            highWaterMark: 1024 * 1024 // 1MB chunks
        });

        // Setup the processing pipeline
        const pipeline = streamChain.chain([
            readStream,
            streamJson.parser(),
            streamArray.streamArray()
        ]);

        // Process data as it arrives
        pipeline.on('data', (data: { key: number, value: Property }) => {
            items.push(data.value);
        });

        // Handle errors
        pipeline.on('error', (err: Error) => {
            console.error(`Error processing JSON from ${filePath}:`, err);
            reject(err);
        });

        // Cleanup on stream end
        pipeline.on('end', () => {
            if (process.env.DEBUG === 'true') {
                console.log(`Successfully loaded ${items.length} items from ${filePath}`);
            }
            resolve(items);
        });
    });
}
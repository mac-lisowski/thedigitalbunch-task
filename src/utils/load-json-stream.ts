import { Property } from "src/types.js";
import fs from 'fs';
import { JSONStream } from 'json-stream';

export async function loadJSONStream(filePath: string): Promise<Property[]> {
    const stream = fs.createReadStream(filePath).pipe(new JSONStream());
    const items: Property[] = [];
    stream.on('data', (data: Property) => items.push(data));
    return new Promise((resolve) => stream.on('end', () => resolve(items)));
}
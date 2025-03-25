import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';

// Install: npm install faker @types/faker

// Property type templates
interface PropertyTemplate {
    base: string;
    alt: string;
}

interface Property {
    description: string;
    limit: string;
    mortgageAmount: string;
}

const propertyTemplates: PropertyTemplate[] = [
    { base: "Single Family Home with {beds} bedrooms and {baths} bathrooms", alt: "Single Family Residence - {beds}BR/{baths}BA" },
    { base: "Waterfront Vacation Property", alt: "Beachfront Holiday Property" },
    { base: "Downtown Commercial Office Space", alt: "Downtown Office Complex" },
    { base: "Retail Store with Storage", alt: "Retail Storefront with Warehouse" },
    { base: "Multi-unit Residential Complex", alt: "Apartment Building Complex" },
    { base: "Gardens and Recreation Area", alt: "Parks and Playground Areas" },
    { base: "Historic Restaurant Building", alt: "Vintage Dining Establishment" },
    { base: "Industrial Warehouse", alt: "Large Storage Facility" },
    { base: "Golf Course Clubhouse", alt: "Country Club Pavilion" },
    { base: "Marina Facility", alt: "Coastal Boating Center" },
    { base: "Shopping Mall", alt: "Retail Shopping Center" },
    { base: "Medical Office Building", alt: "Healthcare Office Space" }
];

// Limit/mortgage formats
const numberFormats: ((n: number) => string)[] = [
    (n: number) => `$${n}`,                  // "$1200000"
    (n: number) => `${n}`,                   // "1200000"
    (n: number) => `${(n / 1000000)}M`,      // "1.2M"
    (n: number) => `${(n / 1000)}K`,         // "1200K"
    (n: number) => `${faker.helpers.arrayElement(['One', 'Two', 'Three', 'Four'])} ${n >= 1000000 ? 'million' : 'hundred thousand'} Dollars`
];

// Generate a property
function generateProperty(template: PropertyTemplate, isList1 = true): Property {
    const beds = faker.number.int({ min: 1, max: 5 });
    const baths = faker.number.int({ min: 1, max: 3 });
    const desc = isList1 ? template.base : template.alt;
    const limit = faker.number.int({ min: 300000, max: 6000000 });
    const mortgage = Math.floor(limit * faker.number.float({ min: 0.6, max: 0.9 })); // 60-90% of limit

    return {
        description: desc
            .replace('{beds}', beds.toString())
            .replace('{baths}', baths.toString())
            .replace('  ', ' '),
        limit: faker.helpers.arrayElement(numberFormats)(limit),
        mortgageAmount: faker.helpers.arrayElement(numberFormats)(mortgage)
    };
}

// Generate matching property with variation
function generateMatchingProperty(template: PropertyTemplate, baseProp: Property): Property {
    const limitBase = parseFloat(baseProp.limit.replace(/[^0-9.]/g, '')) * (baseProp.limit.includes('M') ? 1000000 : baseProp.limit.includes('K') ? 1000 : 1);
    const mortgageBase = parseFloat(baseProp.mortgageAmount.replace(/[^0-9.]/g, '')) * (baseProp.mortgageAmount.includes('M') ? 1000000 : baseProp.mortgageAmount.includes('K') ? 1000 : 1);
    const limitVariation = faker.helpers.arrayElement([0, faker.number.int({ min: 50000, max: 200000 })]); // 0 for Match, else Similar Match
    const mortgageVariation = faker.helpers.arrayElement([0, faker.number.int({ min: 25000, max: 100000 })]);

    const bedsMatch = baseProp.description.match(/\d+/);
    const bathsMatch = baseProp.description.match(/\d+/g);

    return {
        description: template.alt
            .replace('{beds}', bedsMatch?.[0] || '3')
            .replace('{baths}', (bathsMatch && bathsMatch.length > 1) ? bathsMatch[1] : '2')
            .replace('  ', ' '),
        limit: faker.helpers.arrayElement(numberFormats)(limitBase + limitVariation),
        mortgageAmount: faker.helpers.arrayElement(numberFormats)(mortgageBase + mortgageVariation)
    };
}

// Write large JSON file using streams
function writeLargeJsonFile(filePath: string, totalEntries: number, generateFn: (template: PropertyTemplate, index: number) => any): void {
    const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });
    stream.write('[\n');

    let first = true;
    for (let i = 0; i < totalEntries; i++) {
        const template = faker.helpers.arrayElement(propertyTemplates);
        const entry = generateFn(template, i);
        stream.write((first ? '' : ',\n') + JSON.stringify(entry, null, 2));
        first = false;
    }

    stream.write('\n]');
    stream.end();
}

// Generate paired entries for both lists
function generatePairedLargeJsonFiles(list1Path: string, list2Path: string, totalEntries: number, matchPercentage = 0.7): void {
    const list1Stream = fs.createWriteStream(list1Path, { encoding: 'utf8' });
    const list2Stream = fs.createWriteStream(list2Path, { encoding: 'utf8' });
    list1Stream.write('[\n');
    list2Stream.write('[\n');

    let first1 = true, first2 = true;
    const unmatchedList2: Property[] = [];

    for (let i = 0; i < totalEntries; i++) {
        const template = faker.helpers.arrayElement(propertyTemplates);
        const shouldMatch = Math.random() < matchPercentage;

        if (shouldMatch) {
            const p1 = generateProperty(template, true);
            const p2 = generateMatchingProperty(template, p1);
            list1Stream.write((first1 ? '' : ',\n') + JSON.stringify(p1, null, 2));
            list2Stream.write((first2 ? '' : ',\n') + JSON.stringify(p2, null, 2));
        } else {
            const p1 = generateProperty(template, true);
            list1Stream.write((first1 ? '' : ',\n') + JSON.stringify(p1, null, 2));
            unmatchedList2.push(generateProperty(template, false)); // Save for later
        }
        first1 = false;
        first2 = false;
    }

    // Add unmatched entries to list2 to balance counts
    for (let i = unmatchedList2.length; i < totalEntries - Math.floor(totalEntries * matchPercentage); i++) {
        const template = faker.helpers.arrayElement(propertyTemplates);
        unmatchedList2.push(generateProperty(template, false));
    }
    unmatchedList2.slice(0, totalEntries - Math.floor(totalEntries * matchPercentage)).forEach(p => {
        list2Stream.write(',\n' + JSON.stringify(p, null, 2));
    });

    list1Stream.write('\n]');
    list2Stream.write('\n]');
    list1Stream.end();
    list2Stream.end();
}

// Ensure the data directory exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Parse command line arguments
function parseArgs(): { count: number } {
    const args = process.argv.slice(2);
    let count = 1000; // Default value

    // When running with npm scripts, arguments come after -- 
    // e.g. npm run generate-data -- --count 100
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--count' || args[i] === '-c') {
            const countArg = parseInt(args[i + 1], 10);
            if (!isNaN(countArg) && countArg > 0) {
                count = countArg;
                i++; // Skip the next argument as it's the count value
            }
        }
    }

    return { count };
}

// Run
console.log('Generating files...');
const list1Path = path.join(dataDir, 'list1.json');
const list2Path = path.join(dataDir, 'list2.json');
const { count } = parseArgs();
console.log(`Generating ${count} entries...`);
generatePairedLargeJsonFiles(list1Path, list2Path, count, 0.7);
console.log(`Files generated: ${list1Path}, ${list2Path}`);
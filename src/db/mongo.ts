import { Document, MongoClient } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

const DB_NAME = 'niaho_standards';
const COLLECTION_NAME = 'standards';
const SEARCH_INDEX_NAME = 'vector_index';

// MongoDB client instance and environment load flag
let mongoClient: MongoClient | undefined;
let envLoaded = false;

// 
function loadEnv(): void {
  if (envLoaded) {
    return;
  }

  try {
    // Determine the project root directory and locate the .env file to load environment variables
    const scriptDir = __dirname;
    // If we are running from the compiled dist folder, the project root is a few levels up from dist, otherwise it is a couple of levels up from the current script directory
    const projectRoot = scriptDir.includes(`${path.sep}dist${path.sep}`)
      ? path.resolve(scriptDir, '..', '..', '..')
      : path.resolve(scriptDir, '..', '..');
    const envPath = path.join(projectRoot, '.env');

    // If the .env file exists at the computed path, read it and load the environment variables into process.env
    if (fs.existsSync(envPath)) {
      // Read the contents of the .env file as a UTF-8 string
      const envContent = fs.readFileSync(envPath, 'utf8'); // we are decoding the .env file from raw rtext to a UTF-8 string so that we can parse it line by line
      const envVars: Record<string, string> = {}; // object to hold the parsed key=value pairs from the .env file

      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const [key, ...valueParts] = trimmed.split('=');
        if (!key || valueParts.length === 0) {
          continue;
        }

        envVars[key.trim()] = valueParts.join('=').trim();
      }

      Object.assign(process.env, envVars);
    }
  } catch {
    // Avoid stdout/stderr noise for MCP startup.
  }

  envLoaded = true;
}

// Get a connected MongoClient instance, loading environment variables first if needed
export async function getMongoClient(): Promise<MongoClient> {
  loadEnv();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    console.error('[MCP] Connected to MongoDB Atlas');
  }

  return mongoClient; // return the connected MongoClient instance so that callers can use it to access the database
}


// Get the standards collection from the MongoDB database, typed with a generic schema type
export async function getStandardsCollection<TSchema extends Document = Document>() {
  const client = await getMongoClient();
  // access the database by name and get the standards collection, typed with the generic schema type TSchema
  return client.db(DB_NAME).collection<TSchema>(COLLECTION_NAME);
}


export { COLLECTION_NAME, DB_NAME, SEARCH_INDEX_NAME, loadEnv };



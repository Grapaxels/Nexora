import { MongoClient } from 'mongodb';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

let uri = process.env.MONGODB_URI;
let localServer;
let client;
let db;
let connectionPromise;
let indexesPromise;

async function createClient() {
  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI is required in production. Add it in Vercel Project Settings > Environment Variables.');
    }

    // Local development fallback. This is intentionally started lazily so the
    // web UI can boot immediately and MongoDB only starts when an API route
    // actually needs database access.
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = resolve('data/mongo');
    mkdirSync(dbPath, { recursive: true });
    localServer = await MongoMemoryServer.create({
      binary: { downloadDir: resolve('data/mongodb-binaries') },
      instance: { dbPath, storageEngine: 'wiredTiger' },
    });
    uri = localServer.getUri();
  }

  const mongoClient = new MongoClient(uri, {
    serverSelectionTimeoutMS: 6000,
    connectTimeoutMS: 6000,
    maxPoolSize: 10,
    minPoolSize: 0,
  });

  await mongoClient.connect();
  client = mongoClient;
  db = client.db(process.env.MONGODB_DB || 'Nexora');
  return db;
}

async function createIndexes() {
  if (!db) return;
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ id: 1 }, { unique: true }),
    db.collection('codes').createIndex({ email: 1 }, { unique: true }),
    db.collection('codes').createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
    db.collection('sessions').createIndex({ token: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
    db.collection('saved').createIndex({ user_id: 1, listing_id: 1 }, { unique: true }),
    db.collection('votes').createIndex({ user_id: 1, post_id: 1 }, { unique: true }),
    db.collection('listings').createIndex({ created: -1 }),
    db.collection('messages').createIndex({ conversation_id: 1, created: 1 }),
    db.collection('conversations').createIndex(
      { buyer_id: 1, seller_id: 1, listing_id: 1, anonymous: 1 },
      { unique: true },
    ),
    db.collection('arcade_rooms').createIndex({ id: 1 }, { unique: true }),
    db.collection('arcade_rooms').createIndex({ code: 1 }, { unique: true }),
    db.collection('arcade_rooms').createIndex({ gameId: 1, mode: 1, status: 1, created: 1 }),
    db.collection('arcade_rooms').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ...['listings', 'posts', 'comments', 'conversations', 'messages', 'reports'].map(name =>
      db.collection(name).createIndex({ id: 1 }, { unique: true }),
    ),
  ]);
}

export async function ensureDatabase() {
  if (db) return db;

  if (!connectionPromise) {
    connectionPromise = createClient().catch(error => {
      // Allow a later invocation to retry after a transient Atlas/network issue.
      connectionPromise = undefined;
      client = undefined;
      db = undefined;
      throw error;
    });
  }

  await connectionPromise;

  // Index checks are useful, but they should never make every Vercel cold start
  // wait or crash. Start them once per warm function instance in the background.
  if (!indexesPromise) {
    indexesPromise = createIndexes().catch(error => {
      console.error('MongoDB index setup warning:', error.message);
    });
  }

  return db;
}

export const col = name => {
  if (!db) throw new Error('Database has not been initialized for this request.');
  return db.collection(name);
};

export const clean = doc => {
  if (!doc) return null;
  const { _id, ...value } = doc;
  return value;
};

export async function closeDatabase() {
  if (client) await client.close();
  if (localServer) await localServer.stop({ doCleanup: false, force: false });
  client = undefined;
  db = undefined;
  connectionPromise = undefined;
  indexesPromise = undefined;
}

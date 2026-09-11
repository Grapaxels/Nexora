import { MongoClient } from 'mongodb';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
let uri=process.env.MONGODB_URI;
let localServer;
if(!uri){
  if(process.env.NODE_ENV==='production') throw new Error('MONGODB_URI is required in production.');
  // A real MongoDB process with WiredTiger storage persisted on disk for local development.
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath=resolve('data/mongo');mkdirSync(dbPath,{recursive:true});
  localServer=await MongoMemoryServer.create({binary:{downloadDir:resolve('data/mongodb-binaries')},instance:{dbPath,storageEngine:'wiredTiger'}});
  uri=localServer.getUri();
}
export const client=new MongoClient(uri,{serverSelectionTimeoutMS:10000});
await client.connect();
export const db=client.db(process.env.MONGODB_DB || 'Nexora');
export const col=name=>db.collection(name);
await Promise.all([
  col('users').createIndex({email:1},{unique:true}),
  col('users').createIndex({id:1},{unique:true}),
  col('codes').createIndex({email:1},{unique:true}),
  col('codes').createIndex({expires:1},{expireAfterSeconds:0}),
  col('sessions').createIndex({token:1},{unique:true}),
  col('sessions').createIndex({expires:1},{expireAfterSeconds:0}),
  col('saved').createIndex({user_id:1,listing_id:1},{unique:true}),
  col('votes').createIndex({user_id:1,post_id:1},{unique:true}),
  col('listings').createIndex({created:-1}),
  col('messages').createIndex({conversation_id:1,created:1}),
  col('conversations').createIndex({buyer_id:1,seller_id:1,listing_id:1,anonymous:1},{unique:true}),
  ...['listings','posts','comments','conversations','messages','reports'].map(n=>col(n).createIndex({id:1},{unique:true}))
]);
export const clean = doc => {if(!doc)return null;const {_id,...value}=doc;return value;};
export async function closeDatabase(){await client.close();if(localServer)await localServer.stop({doCleanup:false,force:false});}

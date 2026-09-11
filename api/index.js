// Vercel injects Project Environment Variables automatically. dotenv is also
// loaded here so the same function entry point works when testing locally.
import 'dotenv/config';
import app from '../server/index.js';

export default app;

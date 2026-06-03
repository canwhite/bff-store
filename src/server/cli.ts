/**
 * CLI entry point for the embedded server.
 * This file should only be included in the CJS server bundle, NOT in the main library bundle.
 */
import { startServer } from './index';
import type { ServerOptions } from './index';

const args = process.argv.slice(2);
const options: ServerOptions = {
  backend: 'jsonl',
  port: 3847,
  host: 'localhost',
  jsonlDir: './data',
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--backend' && args[i + 1]) {
    options.backend = args[++i] as 'jsonl' | 'mongodb';
  } else if (arg === '--port' && args[i + 1]) {
    options.port = parseInt(args[++i], 10);
  } else if (arg === '--host' && args[i + 1]) {
    options.host = args[++i];
  } else if (arg === '--jsonl-dir' && args[i + 1]) {
    options.jsonlDir = args[++i];
  } else if (arg === '--mongo-url' && args[i + 1]) {
    options.mongoUrl = args[++i];
  } else if (arg === '--mongo-db' && args[i + 1]) {
    options.mongoDb = args[++i];
  } else if (arg === '--help') {
    console.log(`
[bff-store] Embedded Server

Usage:
  bff-store-server [options]

Options:
  --backend <jsonl|mongodb>    Storage backend (default: jsonl)
  --port <port>                 Server port (default: 3847)
  --host <host>                 Server host (default: localhost)
  --jsonl-dir <dir>             JSONL directory (default: ./data)
  --mongo-url <url>             MongoDB URL (required for mongodb backend)
  --mongo-db <db>               MongoDB database (default: jotai_state_store)
  --help                        Show this help

Examples:
  bff-store-server --backend jsonl --jsonl-dir ./data
  bff-store-server --backend mongodb --mongo-url mongodb://localhost:27017
    `);
    process.exit(0);
  }
}

if (options.backend === 'mongodb' && !options.mongoUrl) {
  console.error('[bff-store] Error: --mongo-url required for mongodb backend');
  process.exit(1);
}

startServer(options).catch((err) => {
  console.error('[bff-store] Failed to start:', err);
  process.exit(1);
});

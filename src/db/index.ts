import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const url = process.env.DATABASE_URL || 'file:./data/visor.db';

// Ensure data folder exists if using local file SQLite
if (url.startsWith('file:')) {
  const filePath = url.replace(/^file:/, '');
  const dir = path.dirname(path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const client = createClient({ url });
export const db = drizzle(client, { schema });

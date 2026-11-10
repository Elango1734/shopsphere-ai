import { Schema, model } from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '../connection.js';
import { migration as m0001 } from './0001-normalize-user-emails.js';
import type { Migration } from './types.js';

const MIGRATIONS: Migration[] = [m0001];

const appliedMigrationSchema = new Schema(
  { migrationId: { type: String, required: true, unique: true }, appliedAt: { type: Date, default: () => new Date() } },
  { collection: '_migrations' }
);
const AppliedMigrationModel = model('AppliedMigration', appliedMigrationSchema);

/**
 * Runs every migration in MIGRATIONS whose id is not yet recorded in the
 * `_migrations` collection, in declared order. Each migration's own `up()`
 * must be idempotent/safe to interrupt — the runner records success only
 * after `up()` resolves, so a crash mid-migration is safe to re-run.
 */
export async function runPendingMigrations(): Promise<string[]> {
  const applied = new Set((await AppliedMigrationModel.find().select('migrationId')).map((d) => d.migrationId));
  const ran: string[] = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    console.log(`Applying migration ${migration.id}: ${migration.description}`);
    await migration.up();
    await AppliedMigrationModel.create({ migrationId: migration.id });
    ran.push(migration.id);
  }
  return ran;
}

async function main() {
  await connectToDatabase();
  const ran = await runPendingMigrations();
  console.log(ran.length > 0 ? `Applied: ${ran.join(', ')}` : 'No pending migrations.');
  await disconnectFromDatabase();
}

main().catch((error) => {
  console.error('Migration run failed:', error);
  process.exitCode = 1;
});

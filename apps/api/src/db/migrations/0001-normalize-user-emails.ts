import { UserModel } from '../../models/user.model.js';
import type { Migration } from './types.js';

/**
 * Example/baseline versioned data-change: backfills any pre-existing user
 * documents whose email was stored with mixed case before the schema's
 * `lowercase: true` normalization was in place. Demonstrates the migration
 * pattern required by database-design.md for future backward-compatible
 * schema/index changes (deployment.md) — most real migrations in this
 * project will look like this rather than a destructive rewrite.
 */
export const migration: Migration = {
  id: '0001-normalize-user-emails',
  description: 'Lowercase any user.email values stored before the schema enforced normalization',
  async up() {
    const cursor = UserModel.find({ email: { $exists: true, $type: 'string' } }).cursor();
    for await (const user of cursor) {
      const normalized = user.email!.toLowerCase().trim();
      if (normalized !== user.email) {
        await UserModel.updateOne({ _id: user._id }, { $set: { email: normalized } });
      }
    }
  }
};

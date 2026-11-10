/**
 * Reusable dev tool: force-sets an existing user's email and/or password
 * directly in MongoDB, bypassing the validated `/auth/change-password` API
 * (which requires knowing the current password and a complexity-compliant
 * new one) and the fact that there is no `/auth/change-email` endpoint at
 * all. Intended for local development only — e.g. resetting the seeded
 * admin's credentials, or recovering a locked-out dev account.
 *
 * Usage (from apps/api):
 *   npx tsx src/db/scripts/setAdminCredentials.ts --current-email=<existing> [--email=<new>] [--password=<new>] [--name=<display name>] [--force]
 *
 * --current-email  Required. Which existing user to update, by their current email.
 * --email          Optional. New email. Omit to leave the email unchanged.
 * --password       Optional. New password. Omit to leave the password unchanged.
 * --name            Optional. New display name (customerProfile.displayName).
 * --force           Skip the password complexity check (10+ chars, upper+lower+digit).
 *                    Without --force, a non-compliant --password is rejected up front —
 *                    this script enforces the same rule the API does by default; --force
 *                    is an explicit, deliberate opt-out for local dev convenience only.
 *
 * Example:
 *   npx tsx src/db/scripts/setAdminCredentials.ts --current-email=e.admin@shopsphere.test --password=adminadmin --force
 */
import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '../connection.js';
import { UserModel } from '../../models/user.model.js';
import { hashPassword } from '../../repositories/user.repository.js';
import { changePasswordSchema } from '@shopsphere/validation';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const currentEmail = readArg('current-email');
  const newEmail = readArg('email');
  const newPassword = readArg('password');
  const newName = readArg('name');
  const force = process.argv.includes('--force');

  if (!currentEmail) {
    console.error('Usage: tsx setAdminCredentials.ts --current-email=<existing email> [--email=<new>] [--password=<new>] [--name=<display name>] [--force]');
    process.exitCode = 1;
    return;
  }
  if (!newEmail && !newPassword && !newName) {
    console.error('Nothing to change — pass at least one of --email, --password, --name.');
    process.exitCode = 1;
    return;
  }
  if (newEmail && !EMAIL_FORMAT.test(newEmail)) {
    console.error(`"${newEmail}" is not a valid email format.`);
    process.exitCode = 1;
    return;
  }
  if (newPassword && !force) {
    const result = changePasswordSchema.shape.newPassword.safeParse(newPassword);
    if (!result.success) {
      console.error(`Password rejected: ${result.error.issues.map((i) => i.message).join('; ')}`);
      console.error('Pass --force to bypass this check (dev convenience only — not recommended).');
      process.exitCode = 1;
      return;
    }
  }

  await connectToDatabase();

  const update: Record<string, unknown> = {};
  if (newEmail) update.email = newEmail;
  if (newName) update['customerProfile.displayName'] = newName;
  if (newPassword) update.passwordHash = await hashPassword(newPassword);

  const result = await UserModel.findOneAndUpdate({ email: currentEmail }, { $set: update }, { new: true });

  if (!result) {
    console.error(`No user found with email "${currentEmail}" — nothing updated.`);
    process.exitCode = 1;
    return;
  }

  console.log('Updated:');
  console.log(`  email: ${result.email}`);
  console.log(`  displayName: ${result.get('customerProfile.displayName') ?? '(unchanged)'}`);
  console.log(`  roles: ${result.roles.join(', ')}`);
  if (newPassword) console.log('  password: (set, not printed)');
}

main()
  .catch((error) => {
    console.error('Update failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });

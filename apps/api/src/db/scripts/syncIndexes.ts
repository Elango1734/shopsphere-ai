import { connectToDatabase, disconnectFromDatabase } from '../connection.js';
import { syncAllIndexes } from '../indexes.js';

async function main() {
  await connectToDatabase();
  await syncAllIndexes();
  console.log('All declared indexes synced.');
  await disconnectFromDatabase();
}

main().catch((error) => {
  console.error('Index sync failed:', error);
  process.exitCode = 1;
});

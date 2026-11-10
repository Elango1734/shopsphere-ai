import { connectToDatabase, disconnectFromDatabase } from '../connection.js';
import { verifyAllIndexes } from '../indexes.js';

async function main() {
  await connectToDatabase();
  const results = await verifyAllIndexes();

  let hasMissing = false;
  for (const result of results) {
    const status = result.missing.length > 0 ? 'MISSING INDEXES' : 'OK';
    console.log(
      `${result.collection}: declared=${result.declaredIndexCount} actual=${result.actualIndexCount} [${status}]`
    );
    if (result.missing.length > 0) {
      hasMissing = true;
      for (const m of result.missing) console.log(`  missing: ${m}`);
    }
  }

  await disconnectFromDatabase();
  process.exitCode = hasMissing ? 1 : 0;
}

main().catch((error) => {
  console.error('Index verification failed:', error);
  process.exitCode = 1;
});

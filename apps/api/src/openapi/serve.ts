import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { isProduction } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Served in non-production only (api-specification.md: "served in non-production or access-controlled environments"). */
export function mountOpenApiDocs(app: Express): void {
  if (isProduction()) return;

  const document = parse(readFileSync(path.resolve(__dirname, 'openapi.yaml'), 'utf8'));
  app.get('/api/v1/openapi.json', (_req, res) => res.json(document));
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(document));
}

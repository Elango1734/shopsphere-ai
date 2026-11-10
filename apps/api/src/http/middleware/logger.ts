import type { IncomingMessage, ServerResponse } from 'node:http';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';

/** Structured JSON logs to stdout; secrets/credentials are redacted before they ever reach the log line. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.newPassword',
      'req.body.currentPassword',
      'req.body.refreshToken'
    ],
    censor: '[redacted]'
  }
});

/** Structured JSON request logs with the same request ID the client sees, per deployment.md. */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => (req as unknown as { id: string }).id,
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  }
});

import { AuditLogModel, type AuditLogDocument } from '../models/auditLog.model.js';

export interface AppendAuditLogInput {
  actorUserId?: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  beforeSummary?: Record<string, unknown>;
  afterSummary?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * The only write path exposed for AuditLog — there is deliberately no
 * update/delete export here, and the schema itself rejects update operations
 * (see auditLog.model.ts), so an append-only guarantee holds even if a future
 * caller tries to bypass this repository via the model directly.
 */
export async function appendAuditLog(input: AppendAuditLogInput): Promise<AuditLogDocument> {
  return AuditLogModel.create(input);
}

export async function listAuditLogsForResource(
  resourceType: string,
  resourceId: string,
  page: number,
  pageSize: number
): Promise<{ logs: AuditLogDocument[]; totalItems: number }> {
  const filter = { resourceType, resourceId };
  const skip = (page - 1) * pageSize;
  const [logs, totalItems] = await Promise.all([
    AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    AuditLogModel.countDocuments(filter)
  ]);
  return { logs, totalItems };
}

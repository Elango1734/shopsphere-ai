import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Append-only security/business audit trail. No repository method updates or
 * deletes a log entry (enforced by not exposing one — see
 * repositories/auditLog.repository.ts — and reinforced by rejecting update
 * operations at the schema level below). `beforeSummary`/`afterSummary` are
 * pre-redacted plain objects supplied by the calling service, never raw
 * documents, so secrets/credential hashes/payment data can never reach the
 * log by accident.
 */
const auditLogSchema = new Schema(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, trim: true, maxlength: 40 },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    resourceType: { type: String, required: true, trim: true, maxlength: 60 },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    requestId: { type: String, required: true, trim: true, maxlength: 80 },
    beforeSummary: { type: Schema.Types.Mixed },
    afterSummary: { type: Schema.Types.Mixed },
    ipAddress: { type: String, trim: true, maxlength: 64 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function (next) {
  next(new Error('AuditLog entries are append-only and cannot be updated'));
});

auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ requestId: 1 });

export type AuditLogDocument = HydratedDocument<InferSchemaType<typeof auditLogSchema>>;
export const AuditLogModel = model('AuditLog', auditLogSchema, 'audit_logs');

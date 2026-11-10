import { Schema, Types } from 'mongoose';

export interface StatusHistoryEntry<TStatus extends string = string> {
  status: TStatus;
  changedAt: Date;
  changedBy?: Types.ObjectId;
  note?: string;
}

/**
 * Factory so each state-machine collection (orders, returns, refunds, shipments...)
 * gets its own enum validator while sharing the same embedded shape. History is
 * append-only and naturally bounded by the small number of lifecycle transitions
 * a single document can go through, so embedding is safe here (contrast with
 * unbounded logs like AuditLog, which are their own collection).
 */
export function createStatusHistorySchema<TStatus extends string>(
  allowedStatuses: readonly TStatus[]
): Schema<StatusHistoryEntry<TStatus>> {
  const schema = new Schema(
    {
      status: { type: String, required: true, enum: allowedStatuses as readonly string[] },
      changedAt: { type: Date, required: true, default: () => new Date() },
      changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      note: { type: String, trim: true, maxlength: 500 }
    },
    { _id: false }
  );
  // The runtime schema is identical for every TStatus; only the enum validator differs, so the generic
  // return type here is a type-level view for callers rather than a second distinct schema shape.
  return schema as unknown as Schema<StatusHistoryEntry<TStatus>>;
}

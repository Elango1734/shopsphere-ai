import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const NOTIFICATION_TYPES = [
  'order_update',
  'payment_update',
  'promotion',
  'support_update',
  'review_request',
  'system'
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * Notifications are disposable: once delivered/read they have no ongoing
 * business meaning, so a TTL index safely reclaims storage after a retention
 * window (default 180 days). This is explicitly NOT a pattern reused for
 * records with legal/financial weight (orders, payments, audit logs).
 */
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true, default: 'in_app' },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, trim: true, maxlength: 1000 },
    data: { type: Schema.Types.Mixed },
    readAt: { type: Date },
    deliveredAt: { type: Date },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type NotificationDocument = HydratedDocument<InferSchemaType<typeof notificationSchema>>;
export const NotificationModel = model('Notification', notificationSchema, 'notifications');

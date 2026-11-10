import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const SHIPMENT_STATUSES = ['label_created', 'in_transit', 'out_for_delivery', 'delivered', 'failed'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

const trackingEventSchema = new Schema(
  {
    status: { type: String, enum: SHIPMENT_STATUSES, required: true },
    description: { type: String, trim: true, maxlength: 300 },
    location: { type: String, trim: true, maxlength: 140 },
    occurredAt: { type: Date, required: true, default: () => new Date() }
  },
  { _id: false }
);

/**
 * A multi-seller order can have one shipment per seller's fulfillment unit,
 * hence `sellerId` here rather than deriving shipments purely from the order.
 * Tracking events are embedded (append-only, naturally small per shipment)
 * rather than a separate collection — contrast with SupportMessage, which is
 * unbounded over a ticket's life and is therefore its own collection.
 */
const shipmentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    orderItemVariantIds: { type: [Schema.Types.ObjectId], ref: 'ProductVariant', default: [] },
    carrier: { type: String, trim: true, maxlength: 80 },
    trackingNumber: { type: String, trim: true, maxlength: 100 },
    status: { type: String, enum: SHIPMENT_STATUSES, required: true, default: 'label_created' },
    trackingEvents: { type: [trackingEventSchema], default: [] },
    shippedAt: { type: Date },
    deliveredAt: { type: Date }
  },
  { timestamps: true }
);

shipmentSchema.index({ orderId: 1 });
shipmentSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
shipmentSchema.index({ carrier: 1, trackingNumber: 1 }, { sparse: true });

export type ShipmentDocument = HydratedDocument<InferSchemaType<typeof shipmentSchema>>;
export const ShipmentModel = model('Shipment', shipmentSchema, 'shipments');

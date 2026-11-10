import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/ToastProvider';
import { formatMinor } from '../../utils/money';
import { formatDateTime } from '../../utils/date';

export function SellerOrderDetailPage() {
  const { orderId = '' } = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['seller', 'orders', orderId],
    queryFn: () => api.seller.getOrder(orderId)
  });

  const shipmentMutation = useMutation({
    mutationFn: () =>
      api.seller.createShipment(orderId, {
        carrier: carrier || undefined,
        trackingNumber: trackingNumber || undefined,
        variantIds: order?.items.map((i) => i.variantId) ?? []
      }),
    onSuccess: () => {
      showToast('Shipment created', 'success');
      queryClient.invalidateQueries({ queryKey: ['seller', 'orders', orderId] });
      setIsShipmentModalOpen(false);
      setCarrier('');
      setTrackingNumber('');
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to create shipment', 'error')
  });

  if (isLoading) return <LoadingState label="Loading order…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load order'} onRetry={refetch} />;
  if (!order) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Order {order.id.slice(-8)}</h1>
        <Button onClick={() => setIsShipmentModalOpen(true)}>Create shipment</Button>
      </div>

      <p>
        Payment: <StatusBadge status={order.paymentStatus} /> · Fulfillment: <StatusBadge status={order.fulfillmentStatus} />
      </p>
      <p>Placed: {formatDateTime(order.placedAt)}</p>

      <section>
        <h2>Items</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={`${item.productId}-${item.variantId}`}>
                  <td>{item.name}</td>
                  <td>{item.sku}</td>
                  <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatMinor(item.lineTotal.amountMinor, item.lineTotal.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal title="Create shipment" isOpen={isShipmentModalOpen} onClose={() => setIsShipmentModalOpen(false)}>
        <div className="field">
          <label className="field-label" htmlFor="carrier">
            Carrier
          </label>
          <input id="carrier" className="field-input" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tracking">
            Tracking number
          </label>
          <input id="tracking" className="field-input" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setIsShipmentModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => shipmentMutation.mutate()} disabled={shipmentMutation.isPending}>
            Create shipment
          </Button>
        </div>
      </Modal>
    </div>
  );
}

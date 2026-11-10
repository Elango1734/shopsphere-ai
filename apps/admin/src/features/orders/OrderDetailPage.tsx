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

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [refundModal, setRefundModal] = useState<{ paymentAttemptId: string; maxAmountMinor: number; currency: string } | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'orders', orderId],
    queryFn: () => api.admin.getOrder(orderId)
  });

  const { data: paymentAttempts } = useQuery({
    queryKey: ['admin', 'orders', orderId, 'payment-attempts'],
    queryFn: () => api.admin.listPaymentAttempts(orderId)
  });

  const refundMutation = useMutation({
    mutationFn: (input: { paymentAttemptId: string; requestedAmount: { amountMinor: number; currency: string }; reason?: string }) =>
      api.admin.processRefund(input),
    onSuccess: () => {
      showToast('Refund processed', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders', orderId] });
      setRefundModal(null);
      setRefundAmount('');
      setRefundReason('');
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to process refund', 'error')
  });

  if (isLoading) return <LoadingState label="Loading order…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load order'} onRetry={refetch} />;
  if (!order) return null;

  const succeededAttempts = (paymentAttempts ?? []).filter((a) => a.status === 'succeeded');

  return (
    <div>
      <h1>Order {order.id.slice(-8)}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Status</h3>
          <p>
            Payment: <StatusBadge status={order.paymentStatus} />
          </p>
          <p>
            Fulfillment: <StatusBadge status={order.fulfillmentStatus} />
          </p>
          <p>Placed: {formatDateTime(order.placedAt)}</p>
          {order.cancelledAt && <p>Cancelled: {formatDateTime(order.cancelledAt)}</p>}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Totals</h3>
          <p>Items: {formatMinor(order.itemSubtotal.amountMinor, order.itemSubtotal.currency)}</p>
          <p>Discount: -{formatMinor(order.discountTotal.amountMinor, order.discountTotal.currency)}</p>
          <p>Tax: {formatMinor(order.taxTotal.amountMinor, order.taxTotal.currency)}</p>
          <p>Shipping: {formatMinor(order.shippingTotal.amountMinor, order.shippingTotal.currency)}</p>
          <p style={{ fontWeight: 700 }}>Grand total: {formatMinor(order.grandTotal.amountMinor, order.grandTotal.currency)}</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Shipping address</h3>
          <p>{order.shippingAddress.recipientName}</p>
          <p>
            {order.shippingAddress.addressLine1}
            {order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}
          </p>
          <p>
            {order.shippingAddress.locality}, {order.shippingAddress.region} {order.shippingAddress.postalCode}
          </p>
          <p>{order.shippingAddress.countryCode}</p>
        </div>
      </div>

      <section style={{ marginBottom: 'var(--spacing-6)' }}>
        <h2>Items</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Unit price</th>
                <th style={{ textAlign: 'right' }}>Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={`${item.productId}-${item.variantId}`}>
                  <td>{item.name}</td>
                  <td>{item.sku}</td>
                  <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatMinor(item.unitPrice.amountMinor, item.unitPrice.currency)}</td>
                  <td style={{ textAlign: 'right' }}>{formatMinor(item.lineTotal.amountMinor, item.lineTotal.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--spacing-6)' }}>
        <h2>Payment attempts & refunds</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Method</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Confirmed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(paymentAttempts ?? []).map((attempt) => (
                <tr key={attempt.id}>
                  <td>
                    <StatusBadge status={attempt.status} />
                  </td>
                  <td>{attempt.paymentMethodDisplay ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{formatMinor(attempt.amount.amountMinor, attempt.amount.currency)}</td>
                  <td>{formatDateTime(attempt.confirmedAt)}</td>
                  <td>
                    {attempt.status === 'succeeded' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setRefundModal({
                            paymentAttemptId: attempt.id,
                            maxAmountMinor: attempt.amount.amountMinor,
                            currency: attempt.amount.currency
                          })
                        }
                      >
                        Refund
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {succeededAttempts.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No successful payment attempts to refund
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Status history</h2>
        <ul>
          {order.statusHistory.map((entry, idx) => (
            <li key={idx}>
              [{entry.track}] {entry.status} — {formatDateTime(entry.changedAt)}
              {entry.note ? ` — ${entry.note}` : ''}
            </li>
          ))}
        </ul>
      </section>

      <Modal title="Process refund" isOpen={Boolean(refundModal)} onClose={() => setRefundModal(null)}>
        {refundModal && (
          <>
            <p>Maximum refundable: {formatMinor(refundModal.maxAmountMinor, refundModal.currency)}</p>
            <div className="field">
              <label className="field-label" htmlFor="refund-amount">
                Amount ({refundModal.currency} major units)
              </label>
              <input
                id="refund-amount"
                className="field-input"
                type="number"
                step="0.01"
                min="0"
                max={refundModal.maxAmountMinor / 100}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="refund-reason">
                Reason
              </label>
              <textarea
                id="refund-reason"
                className="field-textarea"
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setRefundModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={refundMutation.isPending || !refundAmount}
                onClick={() =>
                  refundMutation.mutate({
                    paymentAttemptId: refundModal.paymentAttemptId,
                    requestedAmount: { amountMinor: Math.round(Number(refundAmount) * 100), currency: refundModal.currency },
                    reason: refundReason || undefined
                  })
                }
              >
                Confirm refund
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

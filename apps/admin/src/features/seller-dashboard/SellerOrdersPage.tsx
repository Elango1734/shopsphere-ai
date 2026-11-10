import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/ToastProvider';
import { formatMinor } from '../../utils/money';
import { formatDateTime } from '../../utils/date';

const PAGE_SIZE = 20;
const NEXT_STATUS: Record<string, string | null> = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'shipped',
  partially_shipped: 'shipped',
  shipped: 'delivered',
  delivered: null,
  cancelled: null,
  return_requested: null,
  returned: null
};

export function SellerOrdersPage() {
  const [page, setPage] = useState(1);
  const [fulfillmentStatus, setFulfillmentStatus] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['seller', 'orders', page, fulfillmentStatus],
    queryFn: () => api.seller.listOrders({ page, pageSize: PAGE_SIZE, ...(fulfillmentStatus ? { fulfillmentStatus } : {}) })
  });

  const updateMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) => api.seller.updateFulfillment(orderId, status),
    onSuccess: () => {
      showToast('Order updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] });
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to update order', 'error')
  });

  return (
    <div>
      <h1>Orders</h1>

      <FilterBar>
        <FilterField label="Fulfillment status">
          <select className="field-select" value={fulfillmentStatus} onChange={(e) => { setFulfillmentStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="partially_shipped">Partially shipped</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </FilterField>
      </FilterBar>

      <DataTable
        columns={[
          { key: 'id', header: 'Order', render: (r) => r.id.slice(-8) },
          { key: 'payment', header: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus} /> },
          { key: 'fulfillment', header: 'Fulfillment', render: (r) => <StatusBadge status={r.fulfillmentStatus} /> },
          { key: 'total', header: 'Total', render: (r) => formatMinor(r.grandTotal.amountMinor, r.grandTotal.currency), align: 'right' },
          { key: 'placedAt', header: 'Placed', render: (r) => formatDateTime(r.placedAt) },
          {
            key: 'actions',
            header: 'Actions',
            render: (r) => {
              const next = NEXT_STATUS[r.fulfillmentStatus];
              return next ? (
                <Button size="sm" onClick={() => updateMutation.mutate({ orderId: r.id, status: next })} disabled={updateMutation.isPending}>
                  Mark {next.replace(/_/g, ' ')}
                </Button>
              ) : (
                '—'
              );
            }
          }
        ]}
        rows={data?.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load orders' : null}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/seller/orders/${r.id}`)}
        emptyTitle="No orders match this filter"
      />

      {data && <Pagination page={page} pageSize={PAGE_SIZE} totalItems={data.meta.pagination.totalItems} onPageChange={setPage} />}
    </div>
  );
}

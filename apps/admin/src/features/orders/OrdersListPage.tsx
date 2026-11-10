import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatMinor } from '../../utils/money';
import { formatDateTime } from '../../utils/date';

const PAGE_SIZE = 20;

export function OrdersListPage() {
  const [page, setPage] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [fulfillmentStatus, setFulfillmentStatus] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'orders', page, paymentStatus, fulfillmentStatus, customerEmail],
    queryFn: () =>
      api.admin.searchOrders({
        page,
        pageSize: PAGE_SIZE,
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(fulfillmentStatus ? { fulfillmentStatus } : {}),
        ...(customerEmail ? { customerEmail } : {})
      })
  });

  return (
    <div>
      <h1>Orders</h1>

      <FilterBar>
        <FilterField label="Payment status">
          <select className="field-select" value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="authorized">Authorized</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="partially_refunded">Partially refunded</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </FilterField>
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
            <option value="return_requested">Return requested</option>
            <option value="returned">Returned</option>
          </select>
        </FilterField>
        <FilterField label="Customer email">
          <input
            className="field-input"
            type="email"
            value={customerEmail}
            onChange={(e) => { setCustomerEmail(e.target.value); setPage(1); }}
            placeholder="customer@example.com"
          />
        </FilterField>
      </FilterBar>

      <DataTable
        columns={[
          { key: 'id', header: 'Order', render: (r) => r.id.slice(-8) },
          { key: 'payment', header: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus} /> },
          { key: 'fulfillment', header: 'Fulfillment', render: (r) => <StatusBadge status={r.fulfillmentStatus} /> },
          { key: 'items', header: 'Items', render: (r) => r.itemCount, align: 'right' },
          { key: 'total', header: 'Total', render: (r) => formatMinor(r.grandTotal.amountMinor, r.grandTotal.currency), align: 'right' },
          { key: 'placedAt', header: 'Placed', render: (r) => formatDateTime(r.placedAt) }
        ]}
        rows={data?.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load orders' : null}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/orders/${r.id}`)}
        emptyTitle="No orders match these filters"
      />

      {data && <Pagination page={page} pageSize={PAGE_SIZE} totalItems={data.meta.pagination.totalItems} onPageChange={setPage} />}
    </div>
  );
}

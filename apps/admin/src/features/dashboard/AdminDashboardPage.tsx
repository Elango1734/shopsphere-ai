import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { formatMinor } from '../../utils/money';
import { formatDateTime } from '../../utils/date';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable } from '../../components/ui/DataTable';

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 }
];

export function AdminDashboardPage() {
  const [rangeDays, setRangeDays] = useState(30);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'analytics', 'overview', rangeDays],
    queryFn: () => api.admin.getAnalyticsOverview(rangeDays)
  });

  if (isLoading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load dashboard'} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-5)' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label" htmlFor="range-select">
            Date range
          </label>
          <select
            id="range-select"
            className="field-select"
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-6)'
        }}
      >
        <div className="stat-card">
          <span className="stat-card-label">Gross sales</span>
          <span className="stat-card-value">{formatMinor(data.grossSalesMinor, data.currency)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Net revenue</span>
          <span className="stat-card-value">{formatMinor(data.netRevenueMinor, data.currency)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Refunds</span>
          <span className="stat-card-value">{formatMinor(data.refundsTotalMinor, data.currency)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Orders</span>
          <span className="stat-card-value">{data.totalOrders}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Active customers</span>
          <span className="stat-card-value">{data.activeCustomersInRange}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Active sellers</span>
          <span className="stat-card-value">{data.activeSellers}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Products awaiting moderation</span>
          <span className="stat-card-value">{data.productsAwaitingModeration}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Low stock variants</span>
          <span className="stat-card-value">{data.lowStockVariantCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Pending returns</span>
          <span className="stat-card-value">{data.pendingReturnsCount}</span>
        </div>
      </div>

      <section style={{ marginBottom: 'var(--spacing-6)' }}>
        <h2>Top categories by revenue</h2>
        <DataTable
          columns={[
            { key: 'name', header: 'Category', render: (r) => r.categoryName },
            { key: 'orders', header: 'Orders', render: (r) => r.orderCount, align: 'right' },
            { key: 'revenue', header: 'Revenue', render: (r) => formatMinor(r.revenueMinor, data.currency), align: 'right' }
          ]}
          rows={data.categoryPerformance}
          getRowKey={(r) => r.categoryId}
          emptyTitle="No category sales in this range"
        />
      </section>

      <section>
        <h2>Recent orders</h2>
        <DataTable
          columns={[
            { key: 'id', header: 'Order', render: (r) => r.id.slice(-8) },
            { key: 'payment', header: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus} /> },
            { key: 'fulfillment', header: 'Fulfillment', render: (r) => <StatusBadge status={r.fulfillmentStatus} /> },
            { key: 'total', header: 'Total', render: (r) => formatMinor(r.grandTotal.amountMinor, r.grandTotal.currency), align: 'right' },
            { key: 'placedAt', header: 'Placed', render: (r) => formatDateTime(r.placedAt) }
          ]}
          rows={data.recentOrders}
          getRowKey={(r) => r.id}
          emptyTitle="No orders in this range"
        />
      </section>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { formatMinor } from '../../utils/money';

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 }
];

export function SellerDashboardPage() {
  const [rangeDays, setRangeDays] = useState(30);

  const { data: seller } = useQuery({ queryKey: ['seller', 'me'], queryFn: () => api.seller.getMe() });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['seller', 'analytics', rangeDays],
    queryFn: () => api.seller.getAnalyticsOverview(rangeDays)
  });

  if (isLoading) return <LoadingState label="Loading dashboard…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load dashboard'} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-5)' }}>
        <h1 style={{ margin: 0 }}>{seller?.storeName ?? 'Dashboard'}</h1>
        <select className="field-select" value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
        <div className="stat-card">
          <span className="stat-card-label">Revenue (your items)</span>
          <span className="stat-card-value">{formatMinor(data.revenueMinor, data.currency)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Orders</span>
          <span className="stat-card-value">{data.orderCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Pending orders</span>
          <span className="stat-card-value">{data.pendingOrdersCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Low stock variants</span>
          <span className="stat-card-value">{data.lowStockVariantCount}</span>
        </div>
      </div>

      <section style={{ marginTop: 'var(--spacing-6)' }}>
        <h2>Orders by fulfillment status</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.ordersByFulfillmentStatus).map(([status, count]) => (
                <tr key={status}>
                  <td>{status.replace(/_/g, ' ')}</td>
                  <td style={{ textAlign: 'right' }}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { formatMinor } from '../../utils/money';
import { toCsv, downloadCsv } from '../../utils/csv';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';

export function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState(30);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'analytics', 'overview', rangeDays],
    queryFn: () => api.admin.getAnalyticsOverview(rangeDays)
  });

  if (isLoading) return <LoadingState label="Loading report…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load report'} onRetry={refetch} />;
  if (!data) return null;

  function exportOrders() {
    if (!data) return;
    const csv = toCsv(
      data.recentOrders.map((o) => ({
        orderId: o.id,
        customerId: o.customerId,
        paymentStatus: o.paymentStatus,
        fulfillmentStatus: o.fulfillmentStatus,
        totalMinor: o.grandTotal.amountMinor,
        currency: o.grandTotal.currency,
        placedAt: o.placedAt
      })),
      [
        { key: 'orderId', header: 'Order ID' },
        { key: 'customerId', header: 'Customer ID' },
        { key: 'paymentStatus', header: 'Payment status' },
        { key: 'fulfillmentStatus', header: 'Fulfillment status' },
        { key: 'totalMinor', header: 'Total (minor units)' },
        { key: 'currency', header: 'Currency' },
        { key: 'placedAt', header: 'Placed at' }
      ]
    );
    downloadCsv(`orders-${rangeDays}d.csv`, csv);
  }

  function exportCategoryPerformance() {
    if (!data) return;
    const csv = toCsv(
      data.categoryPerformance.map((c) => ({
        category: c.categoryName,
        orders: c.orderCount,
        revenueMinor: c.revenueMinor
      })),
      [
        { key: 'category', header: 'Category' },
        { key: 'orders', header: 'Orders' },
        { key: 'revenueMinor', header: 'Revenue (minor units)' }
      ]
    );
    downloadCsv(`category-performance-${rangeDays}d.csv`, csv);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-5)' }}>
        <h1 style={{ margin: 0 }}>Analytics & reports</h1>
        <select className="field-select" value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 365 days</option>
        </select>
      </div>

      <section className="card" style={{ marginBottom: 'var(--spacing-5)' }}>
        <h2 style={{ marginTop: 0 }}>Revenue breakdown</h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: 640 }}>
          Gross sales is the sum of order totals for orders whose payment was captured in this range. Net revenue subtracts
          refunds approved in the same range. Neither figure subtracts seller commission or payment-processor fees — see
          known limitations in the README.
        </p>
        <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-4)' }}>
          <div>
            <dt style={{ color: 'var(--color-text-muted)' }}>Gross sales</dt>
            <dd style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{formatMinor(data.grossSalesMinor, data.currency)}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--color-text-muted)' }}>Refunds</dt>
            <dd style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{formatMinor(data.refundsTotalMinor, data.currency)}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--color-text-muted)' }}>Net revenue</dt>
            <dd style={{ margin: 0, fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{formatMinor(data.netRevenueMinor, data.currency)}</dd>
          </div>
        </dl>
      </section>

      <section className="card" style={{ marginBottom: 'var(--spacing-5)' }}>
        <h2 style={{ marginTop: 0 }}>Orders by payment status</h2>
        <DataTable
          columns={[
            { key: 'status', header: 'Status', render: (r) => r[0] },
            { key: 'count', header: 'Count', render: (r) => r[1], align: 'right' }
          ]}
          rows={Object.entries(data.ordersByPaymentStatus)}
          getRowKey={(r) => r[0]}
          emptyTitle="No orders in this range"
        />
      </section>

      <section className="card" style={{ marginBottom: 'var(--spacing-5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ marginTop: 0 }}>Category performance</h2>
          <Button variant="secondary" size="sm" onClick={exportCategoryPerformance}>
            Export CSV
          </Button>
        </div>
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

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ marginTop: 0 }}>Recent orders</h2>
          <Button variant="secondary" size="sm" onClick={exportOrders}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={[
            { key: 'id', header: 'Order', render: (r) => r.id.slice(-8) },
            { key: 'payment', header: 'Payment', render: (r) => r.paymentStatus },
            { key: 'fulfillment', header: 'Fulfillment', render: (r) => r.fulfillmentStatus },
            { key: 'total', header: 'Total', render: (r) => formatMinor(r.grandTotal.amountMinor, r.grandTotal.currency), align: 'right' }
          ]}
          rows={data.recentOrders}
          getRowKey={(r) => r.id}
          emptyTitle="No orders in this range"
        />
      </section>
    </div>
  );
}

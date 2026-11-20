import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import type { ComparedMetricDto } from '@shopsphere/api-client';
import { formatMinor } from '../../utils/money';

/** Yesterday in UTC — the same day the API defaults to, so the picker opens on the report being shown. */
function yesterdayUtc(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function Delta({ metric }: { metric: ComparedMetricDto }) {
  if (metric.deltaPct === null) {
    return <span style={{ color: 'var(--color-text-muted)' }}>no prior-day baseline</span>;
  }
  const up = metric.deltaPct >= 0;
  return (
    <span style={{ color: up ? 'var(--color-success)' : 'var(--color-danger)' }}>
      {up ? '↑' : '↓'} {Math.abs(metric.deltaPct)}%
    </span>
  );
}

/**
 * The merchant's morning read. Figures come from the same aggregations as the
 * dashboard below it; the prose line is the only model-written part, and it
 * degrades to a deterministic sentence when no AI provider is configured.
 */
export function DailyReportCard() {
  const [date, setDate] = useState(yesterdayUtc());

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller', 'daily-report', date],
    queryFn: () => api.seller.getDailyReport(date)
  });

  return (
    <section className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--spacing-4)' }}>
        <h2 style={{ margin: 0 }}>Your AI store report</h2>
        <input
          type="date"
          className="field-input"
          value={date}
          max={yesterdayUtc()}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: 'auto' }}
        />
      </div>

      {isLoading ? <p style={{ color: 'var(--color-text-muted)' }}>Reading yesterday&rsquo;s numbers…</p> : null}
      {error ? (
        <p style={{ color: 'var(--color-danger)' }}>
          {error instanceof ApiClientError ? error.message : 'Could not load the daily report'}
        </p>
      ) : null}

      {data ? (
        <>
          <p style={{ fontSize: 'var(--font-size-md)', lineHeight: 1.5 }}>{data.summary}</p>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 0 }}>
            {data.date} compared with {data.comparedTo}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--spacing-4)' }}>
            <div className="stat-card">
              <span className="stat-card-label">Revenue</span>
              <span className="stat-card-value">{formatMinor(data.revenueMinor.current, data.currency)}</span>
              <Delta metric={data.revenueMinor} />
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Orders</span>
              <span className="stat-card-value">{data.orderCount.current}</span>
              <Delta metric={data.orderCount} />
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Units sold</span>
              <span className="stat-card-value">{data.unitsSold.current}</span>
              <Delta metric={data.unitsSold} />
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Average order</span>
              <span className="stat-card-value">{formatMinor(data.averageOrderValueMinor.current, data.currency)}</span>
              <Delta metric={data.averageOrderValueMinor} />
            </div>
          </div>

          <div style={{ marginTop: 'var(--spacing-5)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-3)' }}>Storefront funnel</h3>
            {data.funnel.conversionRatePct === null ? (
              <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
                Not measured on this day — the storefront sent no analytics events.
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                {data.funnel.sessions} session{data.funnel.sessions === 1 ? '' : 's'} → {data.funnel.productViews} product view
                {data.funnel.productViews === 1 ? '' : 's'} → {data.funnel.addToCarts} add{data.funnel.addToCarts === 1 ? '' : 's'} to cart →{' '}
                {data.funnel.ordersPlaced} order{data.funnel.ordersPlaced === 1 ? '' : 's'}. Conversion{' '}
                <strong>{data.funnel.conversionRatePct}%</strong>
                {data.previousFunnel.conversionRatePct !== null ? ` against ${data.previousFunnel.conversionRatePct}% the day before` : ''}
                {data.funnel.cartAbandonmentRatePct !== null ? `, ${data.funnel.cartAbandonmentRatePct}% of carts abandoned` : ''}.
              </p>
            )}
          </div>

          {data.actions.length > 0 ? (
            <div style={{ marginTop: 'var(--spacing-5)' }}>
              <h3 style={{ marginBottom: 'var(--spacing-3)' }}>Recommended actions</h3>
              <ol style={{ margin: 0, paddingLeft: 'var(--spacing-5)', display: 'grid', gap: 'var(--spacing-3)' }}>
                {data.actions.map((action) => (
                  <li key={`${action.kind}-${action.title}`}>
                    <strong>{action.title}</strong>
                    <div style={{ color: 'var(--color-text-muted)' }}>{action.detail}</div>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)' }}>Nothing needs your attention today.</p>
          )}

          {data.topProducts.length > 0 ? (
            <div style={{ marginTop: 'var(--spacing-5)' }}>
              <h3 style={{ marginBottom: 'var(--spacing-3)' }}>Best sellers that day</h3>
              <ul style={{ margin: 0, paddingLeft: 'var(--spacing-5)' }}>
                {data.topProducts.map((p) => (
                  <li key={p.productId}>
                    {p.name} — {p.unitsSold} unit{p.unitsSold === 1 ? '' : 's'}, {formatMinor(p.revenueMinor, data.currency)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

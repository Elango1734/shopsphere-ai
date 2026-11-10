import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate } from '../../utils/date';

const PAGE_SIZE = 20;

export function SellersListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'sellers', page, status],
    queryFn: () =>
      api.admin.listSellers({
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status: status as 'pending_review' | 'active' | 'suspended' | 'rejected' | 'closed' } : {})
      })
  });

  return (
    <div>
      <h1>Sellers</h1>

      <FilterBar>
        <FilterField label="Status">
          <select
            className="field-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="pending_review">Pending review</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
            <option value="closed">Closed</option>
          </select>
        </FilterField>
      </FilterBar>

      <DataTable
        columns={[
          { key: 'storeName', header: 'Store', render: (r) => r.storeName },
          { key: 'slug', header: 'Slug', render: (r) => r.slug },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'createdAt', header: 'Onboarded', render: (r) => formatDate(r.createdAt) }
        ]}
        rows={data?.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load sellers' : null}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/sellers/${r.id}`)}
        emptyTitle="No sellers match these filters"
      />

      {data && <Pagination page={page} pageSize={PAGE_SIZE} totalItems={data.meta.pagination.totalItems} onPageChange={setPage} />}
    </div>
  );
}

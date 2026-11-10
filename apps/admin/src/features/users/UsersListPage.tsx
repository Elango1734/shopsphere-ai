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

export function UsersListPage() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'users', page, role, status],
    queryFn: () =>
      api.admin.listUsers({
        page,
        pageSize: PAGE_SIZE,
        ...(role ? { role: role as 'customer' | 'seller' | 'support_agent' | 'administrator' } : {}),
        ...(status ? { status: status as 'pending_verification' | 'active' | 'suspended' | 'deleted' } : {})
      })
  });

  return (
    <div>
      <h1>Users</h1>

      <FilterBar>
        <FilterField label="Role">
          <select
            className="field-select"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            <option value="customer">Customer</option>
            <option value="seller">Seller</option>
            <option value="support_agent">Support agent</option>
            <option value="administrator">Administrator</option>
          </select>
        </FilterField>
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
            <option value="pending_verification">Pending verification</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </select>
        </FilterField>
      </FilterBar>

      <DataTable
        columns={[
          { key: 'email', header: 'Email / phone', render: (r) => r.email ?? r.phone ?? '—' },
          { key: 'displayName', header: 'Name', render: (r) => r.displayName ?? '—' },
          { key: 'roles', header: 'Roles', render: (r) => r.roles.join(', ') },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'createdAt', header: 'Joined', render: (r) => formatDate(r.createdAt) }
        ]}
        rows={data?.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load users' : null}
        onRetry={refetch}
        onRowClick={(r) => navigate(`/admin/users/${r.id}`)}
        emptyTitle="No users match these filters"
      />

      {data && (
        <Pagination page={page} pageSize={PAGE_SIZE} totalItems={data.meta.pagination.totalItems} onPageChange={setPage} />
      )}
    </div>
  );
}

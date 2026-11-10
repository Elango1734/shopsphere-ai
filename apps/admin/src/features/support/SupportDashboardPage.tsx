import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/ToastProvider';
import { formatDateTime } from '../../utils/date';

const PAGE_SIZE = 20;

export function SupportDashboardPage() {
  const [tab, setTab] = useState<'assigned' | 'unassigned'>('unassigned');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();

  const assignedQuery = useQuery({
    queryKey: ['support-agent', 'assigned', page, status],
    queryFn: () => api.supportAgent.listAssignedTickets({ page, pageSize: PAGE_SIZE, ...(status ? { status: status as 'open' | 'assigned' | 'waiting_on_customer' | 'resolved' | 'closed' } : {}) }),
    enabled: tab === 'assigned'
  });

  const unassignedQuery = useQuery({
    queryKey: ['support-agent', 'unassigned', page],
    queryFn: () => api.supportAgent.listUnassignedTickets(page, PAGE_SIZE),
    enabled: tab === 'unassigned'
  });

  const assignMutation = useMutation({
    mutationFn: (ticketId: string) => api.supportAgent.assignTicket(ticketId, user?.id ?? ''),
    onSuccess: () => {
      showToast('Ticket assigned to you', 'success');
      queryClient.invalidateQueries({ queryKey: ['support-agent'] });
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to assign ticket', 'error')
  });

  const activeQuery = tab === 'assigned' ? assignedQuery : unassignedQuery;

  return (
    <div>
      <h1>Support ticket queue</h1>

      <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
        <Button variant={tab === 'unassigned' ? 'primary' : 'secondary'} size="sm" onClick={() => { setTab('unassigned'); setPage(1); }}>
          Unassigned
        </Button>
        <Button variant={tab === 'assigned' ? 'primary' : 'secondary'} size="sm" onClick={() => { setTab('assigned'); setPage(1); }}>
          My tickets
        </Button>
      </div>

      {tab === 'assigned' && (
        <FilterBar>
          <FilterField label="Status">
            <select className="field-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="waiting_on_customer">Waiting on customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </FilterField>
        </FilterBar>
      )}

      <DataTable
        columns={[
          { key: 'subject', header: 'Subject', render: (r) => r.subject },
          { key: 'category', header: 'Category', render: (r) => r.category },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'lastMessageAt', header: 'Last activity', render: (r) => formatDateTime(r.lastMessageAt) },
          {
            key: 'actions',
            header: 'Actions',
            render: (r) =>
              tab === 'unassigned' ? (
                <Button size="sm" onClick={() => assignMutation.mutate(r.id)} disabled={assignMutation.isPending}>
                  Assign to me
                </Button>
              ) : (
                '—'
              )
          }
        ]}
        rows={activeQuery.data?.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={activeQuery.isLoading}
        error={activeQuery.error instanceof ApiClientError ? activeQuery.error.message : activeQuery.error ? 'Failed to load tickets' : null}
        onRetry={activeQuery.refetch}
        onRowClick={(r) => navigate(`/support/tickets/${r.id}`)}
        emptyTitle={tab === 'unassigned' ? 'No unassigned tickets' : 'No tickets assigned to you'}
      />

      {activeQuery.data && (
        <Pagination page={page} pageSize={PAGE_SIZE} totalItems={activeQuery.data.meta.pagination.totalItems} onPageChange={setPage} />
      )}
    </div>
  );
}

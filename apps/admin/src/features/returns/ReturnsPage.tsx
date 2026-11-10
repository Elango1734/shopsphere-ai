import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { FilterBar, FilterField } from '../../components/ui/FilterBar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/ToastProvider';
import { formatMinor } from '../../utils/money';
import { formatDate } from '../../utils/date';
import type { ReturnRequestDto } from '@shopsphere/api-client';

const PAGE_SIZE = 20;

export function ReturnsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('requested');
  const [reviewing, setReviewing] = useState<ReturnRequestDto | null>(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'returns', page, status],
    queryFn: () => api.admin.listReturns({ page, pageSize: PAGE_SIZE, ...(status ? { status } : {}) })
  });

  const reviewMutation = useMutation({
    mutationFn: ({ returnId, decision, amount }: { returnId: string; decision: 'approved' | 'rejected'; amount?: { amountMinor: number; currency: string } }) =>
      api.admin.reviewReturn(returnId, decision, amount, note || undefined),
    onSuccess: (_, variables) => {
      showToast(`Return ${variables.decision}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'returns'] });
      setReviewing(null);
      setApprovedAmount('');
      setNote('');
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to review return', 'error')
  });

  return (
    <div>
      <h1>Returns & refunds</h1>

      <FilterBar>
        <FilterField label="Status">
          <select className="field-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="in_transit">In transit</option>
            <option value="received">Received</option>
            <option value="refunded">Refunded</option>
            <option value="closed">Closed</option>
            <option value="">All</option>
          </select>
        </FilterField>
      </FilterBar>

      <DataTable
        columns={[
          { key: 'id', header: 'Return', render: (r) => r.id.slice(-8) },
          { key: 'orderId', header: 'Order', render: (r) => r.orderId.slice(-8) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'requested', header: 'Requested amount', render: (r) => formatMinor(r.requestedAmount.amountMinor, r.requestedAmount.currency), align: 'right' },
          { key: 'createdAt', header: 'Submitted', render: (r) => formatDate(r.createdAt) },
          {
            key: 'actions',
            header: 'Actions',
            render: (r) =>
              r.status === 'requested' ? (
                <Button size="sm" onClick={() => setReviewing(r)}>
                  Review
                </Button>
              ) : (
                '—'
              )
          }
        ]}
        rows={data?.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load returns' : null}
        onRetry={refetch}
        emptyTitle="No returns match this filter"
      />

      {data && <Pagination page={page} pageSize={PAGE_SIZE} totalItems={data.meta.pagination.totalItems} onPageChange={setPage} />}

      <Modal title="Review return request" isOpen={Boolean(reviewing)} onClose={() => setReviewing(null)}>
        {reviewing && (
          <>
            <p>
              Requested amount: {formatMinor(reviewing.requestedAmount.amountMinor, reviewing.requestedAmount.currency)}
              {reviewing.reason ? ` — ${reviewing.reason}` : ''}
            </p>
            <div className="field">
              <label className="field-label" htmlFor="approved-amount">
                Approved amount ({reviewing.requestedAmount.currency} major units, leave blank to approve full amount)
              </label>
              <input
                id="approved-amount"
                className="field-input"
                type="number"
                step="0.01"
                min="0"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="return-note">
                Note
              </label>
              <textarea id="return-note" className="field-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end' }}>
              <Button
                variant="danger"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ returnId: reviewing.id, decision: 'rejected' })}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                disabled={reviewMutation.isPending}
                onClick={() =>
                  reviewMutation.mutate({
                    returnId: reviewing.id,
                    decision: 'approved',
                    amount: approvedAmount
                      ? { amountMinor: Math.round(Number(approvedAmount) * 100), currency: reviewing.requestedAmount.currency }
                      : undefined
                  })
                }
              >
                Approve
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

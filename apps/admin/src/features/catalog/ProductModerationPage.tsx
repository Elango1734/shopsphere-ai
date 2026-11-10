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
import { formatDate } from '../../utils/date';

const PAGE_SIZE = 20;

export function ProductModerationPage() {
  const [page, setPage] = useState(1);
  const [moderationStatus, setModerationStatus] = useState('pending_review');
  const [rejecting, setRejecting] = useState<{ productId: string; note: string } | null>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'products', page, moderationStatus],
    queryFn: () =>
      api.admin.listProducts({
        page,
        pageSize: PAGE_SIZE,
        ...(moderationStatus ? { moderationStatus: moderationStatus as 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived' } : {})
      })
  });

  const moderateMutation = useMutation({
    mutationFn: ({ productId, status, note }: { productId: string; status: 'published' | 'rejected' | 'archived'; note?: string }) =>
      api.admin.moderateProduct(productId, status, note),
    onSuccess: (_, variables) => {
      showToast(`Product ${variables.status}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      setRejecting(null);
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to moderate product', 'error')
  });

  return (
    <div>
      <h1>Product moderation</h1>

      <FilterBar>
        <FilterField label="Status">
          <select
            className="field-select"
            value={moderationStatus}
            onChange={(e) => {
              setModerationStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="pending_review">Pending review</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
            <option value="archived">Archived</option>
            <option value="draft">Draft</option>
            <option value="">All</option>
          </select>
        </FilterField>
      </FilterBar>

      <DataTable
        columns={[
          { key: 'name', header: 'Product', render: (r) => r.name },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.moderationStatus} /> },
          { key: 'createdAt', header: 'Submitted', render: (r) => formatDate(r.createdAt) },
          {
            key: 'actions',
            header: 'Actions',
            render: (r) =>
              r.moderationStatus === 'pending_review' ? (
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <Button size="sm" onClick={() => moderateMutation.mutate({ productId: r.id, status: 'published' })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setRejecting({ productId: r.id, note: '' })}>
                    Reject
                  </Button>
                </div>
              ) : (
                '—'
              )
          }
        ]}
        rows={data?.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load products' : null}
        onRetry={refetch}
        emptyTitle="No products match this filter"
      />

      {data && <Pagination page={page} pageSize={PAGE_SIZE} totalItems={data.meta.pagination.totalItems} onPageChange={setPage} />}

      <Modal title="Reject product" isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)}>
        <div className="field">
          <label className="field-label" htmlFor="reject-note">
            Reason (shown to the seller)
          </label>
          <textarea
            id="reject-note"
            className="field-textarea"
            rows={4}
            value={rejecting?.note ?? ''}
            onChange={(e) => setRejecting((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setRejecting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => rejecting && moderateMutation.mutate({ productId: rejecting.productId, status: 'rejected', note: rejecting.note })}
            disabled={moderateMutation.isPending}
          >
            Reject product
          </Button>
        </div>
      </Modal>
    </div>
  );
}

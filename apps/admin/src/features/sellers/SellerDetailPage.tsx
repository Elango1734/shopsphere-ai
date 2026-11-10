import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { formatDateTime } from '../../utils/date';
import { useToast } from '../../components/ui/ToastProvider';

type SellerStatus = 'pending_review' | 'active' | 'suspended' | 'rejected' | 'closed';

const ACTIONS_BY_STATUS: Record<SellerStatus, Array<{ label: string; next: SellerStatus; variant: 'primary' | 'danger' }>> = {
  pending_review: [
    { label: 'Approve seller', next: 'active', variant: 'primary' },
    { label: 'Reject application', next: 'rejected', variant: 'danger' }
  ],
  active: [{ label: 'Suspend seller', next: 'suspended', variant: 'danger' }],
  suspended: [{ label: 'Reinstate seller', next: 'active', variant: 'primary' }],
  rejected: [],
  closed: []
};

export function SellerDetailPage() {
  const { sellerId = '' } = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: seller, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'sellers', sellerId],
    queryFn: () => api.admin.getSeller(sellerId)
  });

  const statusMutation = useMutation({
    mutationFn: (status: SellerStatus) => api.admin.changeSellerStatus(sellerId, status as 'active' | 'suspended' | 'rejected' | 'closed'),
    onSuccess: () => {
      showToast('Seller status updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'sellers'] });
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to update status', 'error')
  });

  if (isLoading) return <LoadingState label="Loading seller…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load seller'} onRetry={refetch} />;
  if (!seller) return null;

  const actions = ACTIONS_BY_STATUS[seller.status as SellerStatus] ?? [];

  return (
    <div>
      <h1>{seller.storeName}</h1>

      <div className="card" style={{ maxWidth: 520 }}>
        <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 'var(--spacing-2) var(--spacing-4)' }}>
          <dt>Slug</dt>
          <dd style={{ margin: 0 }}>{seller.slug}</dd>
          <dt>Status</dt>
          <dd style={{ margin: 0 }}>
            <StatusBadge status={seller.status} />
          </dd>
          <dt>Support email</dt>
          <dd style={{ margin: 0 }}>{seller.supportEmail ?? '—'}</dd>
          <dt>Products</dt>
          <dd style={{ margin: 0 }}>{seller.productCount}</dd>
          <dt>Orders</dt>
          <dd style={{ margin: 0 }}>{seller.orderCount}</dd>
          <dt>Onboarded</dt>
          <dd style={{ margin: 0 }}>{formatDateTime(seller.createdAt)}</dd>
        </dl>

        {actions.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-5)' }}>
            {actions.map((action) => (
              <Button
                key={action.next}
                variant={action.variant}
                onClick={() => statusMutation.mutate(action.next)}
                disabled={statusMutation.isPending}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { formatDateTime } from '../../utils/date';
import { useToast } from '../../components/ui/ToastProvider';

export function UserDetailPage() {
  const { userId = '' } = useParams();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => api.admin.getUser(userId)
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'active' | 'suspended') => api.admin.changeUserStatus(userId, status),
    onSuccess: () => {
      showToast('User status updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to update status', 'error')
  });

  if (isLoading) return <LoadingState label="Loading user…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load user'} onRetry={refetch} />;
  if (!user) return null;

  return (
    <div>
      <h1>{user.displayName ?? user.email ?? user.phone}</h1>

      <div className="card" style={{ maxWidth: 520 }}>
        <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 'var(--spacing-2) var(--spacing-4)' }}>
          <dt>Email</dt>
          <dd style={{ margin: 0 }}>{user.email ?? '—'}</dd>
          <dt>Phone</dt>
          <dd style={{ margin: 0 }}>{user.phone ?? '—'}</dd>
          <dt>Roles</dt>
          <dd style={{ margin: 0 }}>{user.roles.join(', ')}</dd>
          <dt>Status</dt>
          <dd style={{ margin: 0 }}>
            <StatusBadge status={user.status} />
          </dd>
          <dt>Orders placed</dt>
          <dd style={{ margin: 0 }}>{user.orderCount}</dd>
          <dt>Joined</dt>
          <dd style={{ margin: 0 }}>{formatDateTime(user.createdAt)}</dd>
        </dl>

        <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-5)' }}>
          {user.status !== 'suspended' && (
            <Button variant="danger" onClick={() => statusMutation.mutate('suspended')} disabled={statusMutation.isPending}>
              Suspend user
            </Button>
          )}
          {user.status === 'suspended' && (
            <Button variant="primary" onClick={() => statusMutation.mutate('active')} disabled={statusMutation.isPending}>
              Reactivate user
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/ToastProvider';
import { formatDateTime } from '../../utils/date';

export function TicketDetailPage() {
  const { ticketId = '' } = useParams();
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'customer_visible' | 'internal_note'>('customer_visible');
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: messages, isLoading, error, refetch } = useQuery({
    queryKey: ['support-agent', 'tickets', ticketId, 'messages'],
    queryFn: () => api.supportAgent.listMessages(ticketId)
  });

  const sendMutation = useMutation({
    mutationFn: () => api.supportAgent.addMessage(ticketId, body, visibility),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['support-agent', 'tickets', ticketId, 'messages'] });
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to send message', 'error')
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'resolved' | 'closed') => api.supportAgent.updateTicketStatus(ticketId, status),
    onSuccess: () => {
      showToast('Ticket status updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['support-agent'] });
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to update ticket', 'error')
  });

  if (isLoading) return <LoadingState label="Loading ticket…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load ticket'} onRetry={refetch} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Ticket {ticketId.slice(-8)}</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate('resolved')} disabled={statusMutation.isPending}>
            Mark resolved
          </Button>
          <Button variant="secondary" size="sm" onClick={() => statusMutation.mutate('closed')} disabled={statusMutation.isPending}>
            Close ticket
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-5)' }}>
        {(messages ?? []).map((message) => (
          <div
            key={message.id}
            className="card"
            style={{ background: message.visibility === 'internal_note' ? 'var(--color-surface-sunken)' : 'var(--color-surface)' }}
          >
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-1)' }}>
              {formatDateTime(message.createdAt)} {message.visibility === 'internal_note' && <StatusBadge status="internal note" />}
            </div>
            <div>{message.body}</div>
          </div>
        ))}
        {(messages ?? []).length === 0 && <p>No messages yet.</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) sendMutation.mutate();
        }}
      >
        <div className="field">
          <label className="field-label" htmlFor="reply-body">
            Reply
          </label>
          <textarea id="reply-body" className="field-textarea" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <input
              type="checkbox"
              checked={visibility === 'internal_note'}
              onChange={(e) => setVisibility(e.target.checked ? 'internal_note' : 'customer_visible')}
            />
            Internal note (not visible to customer)
          </label>
          <Button type="submit" disabled={!body.trim() || sendMutation.isPending}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

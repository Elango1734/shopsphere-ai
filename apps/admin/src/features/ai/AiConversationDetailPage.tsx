import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { formatDateTime } from '../../utils/date';

export function AiConversationDetailPage() {
  const { conversationId = '' } = useParams();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'ai', 'conversations', conversationId],
    queryFn: () => api.admin.getAiConversation(conversationId)
  });

  if (isLoading) return <LoadingState label="Loading conversation…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load conversation'} onRetry={refetch} />;
  if (!data) return null;

  return (
    <div>
      <h1>Conversation {data.id.slice(-8)}</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        {data.ownerType === 'user' ? 'Registered user' : 'Guest'} · {data.purpose} · Viewing this conversation was recorded in the audit log.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', maxWidth: 720 }}>
        {data.messages.map((message) => (
          <div
            key={message.id}
            className="card"
            style={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              background: message.role === 'user' ? 'var(--color-surface-sunken)' : 'var(--color-surface)'
            }}
          >
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-1)' }}>
              {message.role} · {formatDateTime(message.createdAt)}
            </div>
            <div>{message.content}</div>
          </div>
        ))}
        {data.messages.length === 0 && <p>No messages in this conversation.</p>}
      </div>
    </div>
  );
}

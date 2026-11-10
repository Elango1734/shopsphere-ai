import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { formatDateTime } from '../../utils/date';

const PAGE_SIZE = 20;

export function AiAdminPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const { data: overview, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'ai', 'overview'],
    queryFn: () => api.admin.getAiOverview()
  });

  const { data: conversations } = useQuery({
    queryKey: ['admin', 'ai', 'conversations', page],
    queryFn: () => api.admin.listAiConversations(page, PAGE_SIZE)
  });

  if (isLoading) return <LoadingState label="Loading Sphere AI status…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load AI status'} onRetry={refetch} />;
  if (!overview) return null;

  return (
    <div>
      <h1>Sphere AI administration</h1>

      <div className="card" style={{ marginBottom: 'var(--spacing-6)', maxWidth: 640 }}>
        <h2 style={{ marginTop: 0 }}>Provider status</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--spacing-2) var(--spacing-4)' }}>
          <dt>Provider</dt>
          <dd style={{ margin: 0 }}>{overview.provider}</dd>
          <dt>Model</dt>
          <dd style={{ margin: 0 }}>{overview.model ?? '—'}</dd>
          <dt>API key configured</dt>
          <dd style={{ margin: 0 }}>{overview.apiKeyConfigured ? 'Yes' : 'No (using the keyword-matching development provider)'}</dd>
        </dl>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 0 }}>
          The current build runs a rule-based development provider (keyword matching over the catalog), not a hosted LLM — see
          known limitations in the README. No raw API key is ever returned to this UI.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
        <div className="stat-card">
          <span className="stat-card-label">Total conversations</span>
          <span className="stat-card-value">{overview.totalConversations}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Active conversations</span>
          <span className="stat-card-value">{overview.activeConversations}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Total messages</span>
          <span className="stat-card-value">{overview.totalMessages}</span>
        </div>
        {Object.entries(overview.conversationsByPurpose).map(([purpose, count]) => (
          <div className="stat-card" key={purpose}>
            <span className="stat-card-label">{purpose}</span>
            <span className="stat-card-value">{count}</span>
          </div>
        ))}
      </div>

      <section>
        <h2>Conversations</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Metadata only — opening a conversation is a deliberate, audit-logged action (see the audit log).
        </p>
        <DataTable
          columns={[
            { key: 'id', header: 'Conversation', render: (r) => r.id.slice(-8) },
            { key: 'owner', header: 'Owner', render: (r) => (r.ownerType === 'user' ? 'Registered user' : 'Guest') },
            { key: 'purpose', header: 'Purpose', render: (r) => r.purpose },
            { key: 'messages', header: 'Messages', render: (r) => r.messageCount, align: 'right' },
            { key: 'lastMessageAt', header: 'Last message', render: (r) => formatDateTime(r.lastMessageAt) }
          ]}
          rows={conversations?.data ?? []}
          getRowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/admin/ai/conversations/${r.id}`)}
          emptyTitle="No AI conversations yet"
        />
        {conversations && (
          <Pagination page={page} pageSize={PAGE_SIZE} totalItems={conversations.meta.pagination.totalItems} onPageChange={setPage} />
        )}
      </section>
    </div>
  );
}

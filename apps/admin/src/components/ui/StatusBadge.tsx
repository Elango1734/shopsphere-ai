const TONE_BY_STATUS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active: 'success',
  published: 'success',
  approved: 'success',
  delivered: 'success',
  resolved: 'success',
  succeeded: 'success',
  paid: 'success',
  pending: 'warning',
  pending_review: 'warning',
  pending_verification: 'warning',
  processing: 'warning',
  confirmed: 'info',
  shipped: 'info',
  assigned: 'info',
  waiting_on_customer: 'info',
  open: 'info',
  partially_shipped: 'info',
  partially_refunded: 'info',
  draft: 'neutral',
  closed: 'neutral',
  suspended: 'danger',
  rejected: 'danger',
  cancelled: 'danger',
  failed: 'danger',
  archived: 'neutral',
  refunded: 'info',
  requested: 'warning',
  in_transit: 'info',
  received: 'info',
  returned: 'neutral',
  return_requested: 'warning',
  deleted: 'danger'
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE_BY_STATUS[status] ?? 'neutral';
  return <span className={`badge badge-${tone}`}>{status.replace(/_/g, ' ')}</span>;
}

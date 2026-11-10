export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-panel" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="state-panel">
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </div>
  );
}

export function AccessDeniedState({ message = "You don't have permission to view this page." }: { message?: string }) {
  return (
    <div className="state-panel" role="alert">
      <strong>Access denied</strong>
      <span>{message}</span>
    </div>
  );
}

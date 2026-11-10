import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

/** Layout shell for a row of filter controls — callers supply their own labeled inputs/selects as children. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="filter-bar" role="search">
      {children}
    </div>
  );
}

/**
 * Generates a stable id and wires it to the label via `htmlFor` AND onto the
 * single form control child via `id`, so the label is programmatically
 * associated with its control (not just visually adjacent) — required for
 * screen readers and for `getByLabelText` queries alike.
 */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children;
  return (
    <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {control}
    </div>
  );
}

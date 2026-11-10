import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';
import type { ReactNode } from 'react';

/**
 * `<Controller>`'s JSX usage is incompatible with React 19's stricter JSX
 * element types under react-hook-form 7.56.3 (the same issue the mobile app
 * hit — see apps/mobile's own ControlledTextInput). Calling `useController`
 * directly inside a plain function component sidesteps it entirely.
 */

interface BaseProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  hint?: string;
  required?: boolean;
}

export function ControlledTextInput<T extends FieldValues>({
  name,
  control,
  label,
  hint,
  required,
  type = 'text',
  ...rest
}: BaseProps<T> & { type?: string; placeholder?: string; autoComplete?: string }) {
  const { field, fieldState } = useController({ name, control });
  const errorId = `${name}-error`;
  return (
    <div className="field">
      <label className="field-label" htmlFor={name}>
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={name}
        className="field-input"
        type={type}
        value={field.value ?? ''}
        onChange={(e) => field.onChange(type === 'number' ? e.target.valueAsNumber : e.target.value)}
        onBlur={field.onBlur}
        aria-invalid={Boolean(fieldState.error)}
        aria-describedby={fieldState.error ? errorId : undefined}
        {...rest}
      />
      {hint && !fieldState.error && <span className="field-hint">{hint}</span>}
      {fieldState.error && (
        <span id={errorId} className="field-error" role="alert">
          {fieldState.error.message}
        </span>
      )}
    </div>
  );
}

export function ControlledTextArea<T extends FieldValues>({
  name,
  control,
  label,
  hint,
  required,
  rows = 4
}: BaseProps<T> & { rows?: number }) {
  const { field, fieldState } = useController({ name, control });
  return (
    <div className="field">
      <label className="field-label" htmlFor={name}>
        {label}
        {required ? ' *' : ''}
      </label>
      <textarea
        id={name}
        className="field-textarea"
        rows={rows}
        value={field.value ?? ''}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        aria-invalid={Boolean(fieldState.error)}
      />
      {hint && !fieldState.error && <span className="field-hint">{hint}</span>}
      {fieldState.error && (
        <span className="field-error" role="alert">
          {fieldState.error.message}
        </span>
      )}
    </div>
  );
}

export function ControlledSelect<T extends FieldValues>({
  name,
  control,
  label,
  hint,
  required,
  children
}: BaseProps<T> & { children: ReactNode }) {
  const { field, fieldState } = useController({ name, control });
  return (
    <div className="field">
      <label className="field-label" htmlFor={name}>
        {label}
        {required ? ' *' : ''}
      </label>
      <select
        id={name}
        className="field-select"
        value={field.value ?? ''}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        aria-invalid={Boolean(fieldState.error)}
      >
        {children}
      </select>
      {hint && !fieldState.error && <span className="field-hint">{hint}</span>}
      {fieldState.error && (
        <span className="field-error" role="alert">
          {fieldState.error.message}
        </span>
      )}
    </div>
  );
}

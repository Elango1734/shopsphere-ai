import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema } from '@shopsphere/validation';
import { z } from 'zod';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { ApiClientError } from '@shopsphere/api-client';
import { ControlledTextInput } from '../../components/ui/ControlledField';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/ToastProvider';

const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string().min(1) })
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;

export function AccountPage() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  });

  const changePasswordMutation = useMutation({
    mutationFn: (values: ChangePasswordFormInput) => api.auth.changePassword(values.currentPassword, values.newPassword),
    onSuccess: async () => {
      reset();
      showToast('Password changed. Signing you out so you can sign back in with it — this also ends your other sessions.', 'success');
      // Changing a password revokes every refresh session for this account, including the
      // current one (apps/api's auth.service.ts changePassword -> revokeAllSessionsForUser) —
      // logging out immediately here avoids leaving the UI looking signed-in for the ~15min
      // until the access token naturally expires and the next silent refresh fails.
      setTimeout(async () => {
        await logout();
        navigate('/login', { replace: true });
      }, 1800);
    },
    onError: (err) => {
      setSubmitError(err instanceof ApiClientError ? err.message : 'Failed to change password');
    }
  });

  return (
    <div>
      <h1>My account</h1>

      <div className="card" style={{ maxWidth: 480, marginBottom: 'var(--spacing-5)' }}>
        <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 'var(--spacing-2) var(--spacing-4)' }}>
          <dt>Email</dt>
          <dd style={{ margin: 0 }}>{user?.email ?? '—'}</dd>
          <dt>Phone</dt>
          <dd style={{ margin: 0 }}>{user?.phone ?? '—'}</dd>
          <dt>Roles</dt>
          <dd style={{ margin: 0 }}>{user?.roles.join(', ')}</dd>
        </dl>
        <p className="field-hint" style={{ marginTop: 'var(--spacing-3)', marginBottom: 0 }}>
          There is no way to change your email address yet — only password changes are supported.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Change password</h2>
        <form
          onSubmit={handleSubmit((values) => {
            setSubmitError(null);
            changePasswordMutation.mutate(values);
          })}
          noValidate
        >
          <ControlledTextInput
            name="currentPassword"
            control={control}
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
          />
          <ControlledTextInput
            name="newPassword"
            control={control}
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 10 characters, with an uppercase letter, a lowercase letter, and a digit."
          />
          <ControlledTextInput
            name="confirmPassword"
            control={control}
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
          />

          {submitError && (
            <p className="field-error" role="alert">
              {submitError}
            </p>
          )}

          <Button type="submit" disabled={formState.isSubmitting || changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      </div>
    </div>
  );
}

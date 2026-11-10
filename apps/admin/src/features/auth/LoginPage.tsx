import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@shopsphere/validation';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ControlledTextInput } from '../../components/ui/ControlledField';
import { Button } from '../../components/ui/Button';
import { ApiClientError } from '@shopsphere/api-client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  async function onSubmit(values: LoginInput) {
    setSubmitError(null);
    try {
      await login(values.email ?? '', values.password);
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setSubmitError(err.code === 'INVALID_CREDENTIALS' ? 'Incorrect email or password.' : err.message);
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card"
        style={{ width: '100%', maxWidth: 360 }}
        aria-labelledby="login-heading"
        noValidate
      >
        <h1 id="login-heading" style={{ marginTop: 0 }}>
          ShopSphere AI
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 0 }}>Operations console sign-in</p>

        <ControlledTextInput name="email" control={control} label="Email" type="email" autoComplete="username" required />
        <ControlledTextInput name="password" control={control} label="Password" type="password" autoComplete="current-password" required />

        {submitError && (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        )}

        <Button type="submit" disabled={formState.isSubmitting} style={{ width: '100%' }}>
          {formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}

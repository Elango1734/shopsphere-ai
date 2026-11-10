import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ControlledTextInput } from '../../src/components/ui/ControlledField';

const schema = z.object({ name: z.string().trim().min(1, 'Name is required') });
type FormValues = z.infer<typeof schema>;

function TestForm() {
  const { control, handleSubmit } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '' } });
  return (
    <form onSubmit={handleSubmit(() => {})}>
      <ControlledTextInput name="name" control={control} label="Name" required />
      <button type="submit">Submit</button>
    </form>
  );
}

describe('ControlledTextInput', () => {
  it('associates the visible label with the input via htmlFor/id so it is reachable by its accessible name', () => {
    render(<TestForm />);
    const input = screen.getByLabelText(/name/i);
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('marks the input aria-invalid and renders an alert-role error after a failed validation', async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    const input = screen.getByLabelText(/name/i);
    expect(input).toHaveAttribute('aria-invalid', 'false');

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/name is required/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
  });
});

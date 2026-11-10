import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCouponSchema } from '@shopsphere/validation';
import type { z } from 'zod';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ControlledTextInput, ControlledSelect } from '../../components/ui/ControlledField';
import { useToast } from '../../components/ui/ToastProvider';
import { formatMinor } from '../../utils/money';
import { formatDate } from '../../utils/date';

type CreateCouponInput = z.infer<typeof createCouponSchema>;

const PAGE_SIZE = 20;

export function CouponsPage() {
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'coupons', page],
    queryFn: () => api.admin.listCoupons(page, PAGE_SIZE)
  });

  function toDateInputValue(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * The form only shows one currency field (the coupon's own) and one bare
   * `amountMinor` input per optional money field (`minOrderAmount`,
   * `discountValue`, `maxDiscount`) rather than a redundant currency picker
   * per field. React Hook Form still creates a nested `{ amountMinor }`
   * object the moment that input is touched, even when left blank
   * (`valueAsNumber` on an empty number input is `NaN`, not `undefined`), so
   * `createCouponSchema`'s `.optional()` on those fields would otherwise see
   * a half-formed object and reject it as missing `currency` — a real bug
   * that would block creating any coupon where an optional field was left
   * blank. This resolver runs before Zod sees the data: it drops a money
   * sub-object entirely when its amount is blank, and fills in the coupon's
   * own currency when it's genuinely set.
   */
  function sanitizeCouponFormValues(values: CreateCouponInput): CreateCouponInput {
    const sanitized = { ...values } as Record<string, unknown>;
    for (const key of ['minOrderAmount', 'discountValue', 'maxDiscount'] as const) {
      const field = sanitized[key] as { amountMinor?: number } | undefined;
      if (field == null || field.amountMinor == null || Number.isNaN(field.amountMinor)) {
        delete sanitized[key];
      } else {
        sanitized[key] = { amountMinor: field.amountMinor, currency: values.currency };
      }
    }
    return sanitized as CreateCouponInput;
  }

  const couponResolver = zodResolver(createCouponSchema);
  const resolver: Resolver<CreateCouponInput> = (values, context, options) =>
    couponResolver(sanitizeCouponFormValues(values), context, options);

  const { control, handleSubmit, reset, watch, formState } = useForm<CreateCouponInput>({
    resolver,
    defaultValues: {
      code: '',
      discountType: 'percentage',
      currency: 'USD',
      startsAt: toDateInputValue(new Date()) as unknown as Date,
      expiresAt: toDateInputValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) as unknown as Date,
      perUserLimit: 1
    } as Partial<CreateCouponInput> as CreateCouponInput
  });

  const discountType = watch('discountType');

  const createMutation = useMutation({
    mutationFn: (values: CreateCouponInput) =>
      api.admin.createCoupon({
        ...values,
        startsAt: new Date(values.startsAt).toISOString(),
        expiresAt: new Date(values.expiresAt).toISOString()
      }),
    onSuccess: () => {
      showToast('Coupon created', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to create coupon', 'error')
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Coupons</h1>
        <Button onClick={() => setIsModalOpen(true)}>New coupon</Button>
      </div>

      <DataTable
        columns={[
          { key: 'code', header: 'Code', render: (r) => r.code },
          { key: 'type', header: 'Type', render: (r) => r.discountType.replace('_', ' ') },
          {
            key: 'value',
            header: 'Value',
            render: (r) => (r.discountType === 'percentage' ? `${(r.percentageBasisPoints ?? 0) / 100}%` : formatMinor(r.discountValue?.amountMinor ?? 0, r.currency))
          },
          { key: 'usage', header: 'Used', render: (r) => `${r.usedCount}${r.usageLimit ? ` / ${r.usageLimit}` : ''}`, align: 'right' },
          { key: 'active', header: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
          { key: 'expiresAt', header: 'Expires', render: (r) => formatDate(r.expiresAt) }
        ]}
        rows={data?.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load coupons' : null}
        onRetry={refetch}
        emptyTitle="No coupons yet"
      />

      {data && <Pagination page={page} pageSize={PAGE_SIZE} totalItems={data.meta.pagination.totalItems} onPageChange={setPage} />}

      <Modal title="New coupon" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} noValidate>
          <ControlledTextInput name="code" control={control} label="Code" required />
          <ControlledSelect name="discountType" control={control} label="Discount type" required>
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed amount</option>
          </ControlledSelect>
          {discountType === 'percentage' ? (
            <ControlledTextInput
              name="percentageBasisPoints"
              control={control}
              label="Percentage (basis points, e.g. 1000 = 10%)"
              type="number"
            />
          ) : (
            <ControlledTextInput name="discountValue.amountMinor" control={control} label="Discount amount (minor units)" type="number" />
          )}
          <ControlledTextInput name="currency" control={control} label="Currency" required hint="3-letter ISO code, e.g. USD" />
          <ControlledTextInput name="startsAt" control={control} label="Starts" type="date" required />
          <ControlledTextInput name="expiresAt" control={control} label="Expires" type="date" required />
          <ControlledTextInput name="minOrderAmount.amountMinor" control={control} label="Minimum order (minor units, optional)" type="number" />
          <ControlledTextInput name="usageLimit" control={control} label="Total usage limit (optional)" type="number" />
          <ControlledTextInput name="perUserLimit" control={control} label="Per-user limit" type="number" required />
          <ControlledTextInput name="description" control={control} label="Description (optional)" />
          <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting || createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

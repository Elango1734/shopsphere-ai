import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createVariantSchema } from '@shopsphere/validation';
import type { z } from 'zod';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ControlledTextInput } from '../../components/ui/ControlledField';
import { useToast } from '../../components/ui/ToastProvider';
import { formatMinor } from '../../utils/money';

type CreateVariantInput = z.infer<typeof createVariantSchema>;

export function SellerProductDetailPage() {
  const { productId = '' } = useParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: variants, isLoading, error, refetch } = useQuery({
    queryKey: ['seller', 'products', productId, 'variants'],
    queryFn: () => api.seller.listVariants(productId)
  });

  const { control, handleSubmit, reset, formState } = useForm<CreateVariantInput>({
    resolver: zodResolver(createVariantSchema),
    defaultValues: { sku: '', attributes: {}, regularPrice: { amountMinor: 0, currency: 'USD' }, initialOnHand: 0 }
  });

  const createVariantMutation = useMutation({
    mutationFn: (values: CreateVariantInput) => api.seller.createVariant(productId, values),
    onSuccess: () => {
      showToast('Variant created', 'success');
      queryClient.invalidateQueries({ queryKey: ['seller', 'products', productId, 'variants'] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to create variant', 'error')
  });

  const updateInventoryMutation = useMutation({
    mutationFn: ({ variantId, onHand }: { variantId: string; onHand: number }) => api.seller.updateInventory(variantId, onHand),
    onSuccess: () => {
      showToast('Inventory updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['seller', 'products', productId, 'variants'] });
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to update inventory', 'error')
  });

  if (isLoading) return <LoadingState label="Loading variants…" />;
  if (error) return <ErrorState message={error instanceof ApiClientError ? error.message : 'Failed to load variants'} onRetry={refetch} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Variants</h1>
        <Button onClick={() => setIsModalOpen(true)}>New variant</Button>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th style={{ textAlign: 'right' }}>Price</th>
              <th style={{ textAlign: 'right' }}>On hand</th>
              <th style={{ textAlign: 'right' }}>Available</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(variants ?? []).map((variant) => (
              <tr key={variant.id}>
                <td>{variant.sku}</td>
                <td style={{ textAlign: 'right' }}>{formatMinor(variant.regularPrice.amountMinor, variant.regularPrice.currency)}</td>
                <td style={{ textAlign: 'right' }}>{variant.inventory?.onHand ?? 0}</td>
                <td style={{ textAlign: 'right' }}>{variant.inventory?.available ?? 0}</td>
                <td>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                    <input
                      className="field-input"
                      type="number"
                      min="0"
                      style={{ width: 90 }}
                      placeholder="New qty"
                      value={stockEdits[variant.id] ?? ''}
                      onChange={(e) => setStockEdits((prev) => ({ ...prev, [variant.id]: e.target.value }))}
                      aria-label={`New on-hand quantity for ${variant.sku}`}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!stockEdits[variant.id] || updateInventoryMutation.isPending}
                      onClick={() =>
                        updateInventoryMutation.mutate({ variantId: variant.id, onHand: Number(stockEdits[variant.id]) })
                      }
                    >
                      Update
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(variants ?? []).length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No variants yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal title="New variant" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleSubmit((values) => createVariantMutation.mutate(values))} noValidate>
          <ControlledTextInput name="sku" control={control} label="SKU" required />
          <ControlledTextInput name="regularPrice.amountMinor" control={control} label="Price (minor units)" type="number" required />
          <ControlledTextInput name="regularPrice.currency" control={control} label="Currency" required hint="3-letter ISO code" />
          <ControlledTextInput name="initialOnHand" control={control} label="Initial stock on hand" type="number" />
          <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting || createVariantMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

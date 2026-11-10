import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/ToastProvider';

export function SellerInventoryPage() {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['seller', 'inventory', 'low-stock'],
    queryFn: () => api.seller.listLowStock()
  });

  const updateMutation = useMutation({
    mutationFn: ({ variantId, onHand }: { variantId: string; onHand: number }) => api.seller.updateInventory(variantId, onHand),
    onSuccess: () => {
      showToast('Inventory updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['seller', 'inventory', 'low-stock'] });
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to update inventory', 'error')
  });

  return (
    <div>
      <h1>Low stock inventory</h1>

      <DataTable
        columns={[
          { key: 'variantId', header: 'Variant', render: (r) => r.variantId.slice(-8) },
          { key: 'onHand', header: 'On hand', render: (r) => r.onHand, align: 'right' },
          { key: 'reserved', header: 'Reserved', render: (r) => r.reserved, align: 'right' },
          { key: 'available', header: 'Available', render: (r) => r.available, align: 'right' },
          { key: 'threshold', header: 'Threshold', render: (r) => r.lowStockThreshold, align: 'right' },
          {
            key: 'actions',
            header: 'Restock',
            render: (r) => (
              <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  style={{ width: 90 }}
                  placeholder="New qty"
                  value={edits[r.variantId] ?? ''}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [r.variantId]: e.target.value }))}
                  aria-label={`New on-hand quantity for variant ${r.variantId}`}
                />
                <Button
                  size="sm"
                  disabled={!edits[r.variantId] || updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ variantId: r.variantId, onHand: Number(edits[r.variantId]) })}
                >
                  Update
                </Button>
              </div>
            )
          }
        ]}
        rows={data ?? []}
        getRowKey={(r) => r.variantId}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load inventory' : null}
        onRetry={refetch}
        emptyTitle="No low-stock variants"
      />
    </div>
  );
}

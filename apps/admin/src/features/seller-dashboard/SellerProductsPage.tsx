import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProductSchema } from '@shopsphere/validation';
import type { z } from 'zod';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ControlledTextInput, ControlledSelect } from '../../components/ui/ControlledField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useToast } from '../../components/ui/ToastProvider';

type CreateProductInput = Pick<z.infer<typeof createProductSchema>, 'categoryId' | 'name' | 'description'>;

const PAGE_SIZE = 20;

export function SellerProductsPage() {
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['seller', 'products', page],
    queryFn: () => api.seller.listProducts(page, PAGE_SIZE)
  });

  const { data: categories } = useQuery({ queryKey: ['catalog', 'categories'], queryFn: () => api.catalog.listCategories() });

  const { control, handleSubmit, reset, formState } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema.pick({ categoryId: true, name: true, description: true })),
    defaultValues: { categoryId: '', name: '', description: '' }
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateProductInput) => api.seller.createProduct(values),
    onSuccess: () => {
      showToast('Product created as draft', 'success');
      queryClient.invalidateQueries({ queryKey: ['seller', 'products'] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to create product', 'error')
  });

  const submitMutation = useMutation({
    mutationFn: (productId: string) => api.seller.submitProductForReview(productId),
    onSuccess: () => {
      showToast('Submitted for review', 'success');
      queryClient.invalidateQueries({ queryKey: ['seller', 'products'] });
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to submit product', 'error')
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Products</h1>
        <Button onClick={() => setIsModalOpen(true)}>New product</Button>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (r) => r.name },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.moderationStatus} /> },
          { key: 'stock', header: 'In stock', render: (r) => (r.hasAvailableStock ? 'Yes' : 'No') },
          {
            key: 'actions',
            header: 'Actions',
            render: (r) => (
              <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/seller/products/${r.id}`)}>
                  Manage variants
                </Button>
                {(r.moderationStatus === 'draft' || r.moderationStatus === 'rejected') && (
                  <Button size="sm" onClick={() => submitMutation.mutate(r.id)} disabled={submitMutation.isPending}>
                    Submit for review
                  </Button>
                )}
              </div>
            )
          }
        ]}
        rows={data?.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load products' : null}
        onRetry={refetch}
        emptyTitle="No products yet"
      />

      {data && <Pagination page={page} pageSize={PAGE_SIZE} totalItems={data.meta.pagination.totalItems} onPageChange={setPage} />}

      <Modal title="New product" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} noValidate>
          <ControlledSelect name="categoryId" control={control} label="Category" required>
            <option value="">Select a category</option>
            {(categories ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </ControlledSelect>
          <ControlledTextInput name="name" control={control} label="Product name" required />
          <ControlledTextInput name="description" control={control} label="Description" />
          <p className="field-hint">Variants/SKUs, images, and attributes are added after creation from the product's detail page.</p>
          <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end' }}>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting || createMutation.isPending}>
              Create draft
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

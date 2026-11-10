import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createBrandSchema } from '@shopsphere/validation';
import type { z } from 'zod';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ControlledTextInput } from '../../components/ui/ControlledField';
import { useToast } from '../../components/ui/ToastProvider';

type CreateBrandInput = z.infer<typeof createBrandSchema>;

export function BrandsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: () => api.catalog.listBrands()
  });

  const { control, handleSubmit, reset, formState } = useForm<CreateBrandInput>({
    resolver: zodResolver(createBrandSchema),
    defaultValues: { name: '', slug: '', description: '' }
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateBrandInput) => api.admin.createBrand(values),
    onSuccess: () => {
      showToast('Brand created', 'success');
      queryClient.invalidateQueries({ queryKey: ['catalog', 'brands'] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to create brand', 'error')
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Brands</h1>
        <Button onClick={() => setIsModalOpen(true)}>New brand</Button>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (r) => r.name },
          { key: 'slug', header: 'Slug', render: (r) => r.slug },
          { key: 'description', header: 'Description', render: (r) => r.description ?? '—' }
        ]}
        rows={data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load brands' : null}
        onRetry={refetch}
        emptyTitle="No brands yet"
      />

      <Modal title="New brand" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} noValidate>
          <ControlledTextInput name="name" control={control} label="Name" required />
          <ControlledTextInput name="slug" control={control} label="Slug" required />
          <ControlledTextInput name="description" control={control} label="Description" />
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

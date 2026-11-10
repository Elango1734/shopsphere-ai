import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCategorySchema } from '@shopsphere/validation';
import type { z } from 'zod';
import { api } from '../../api/client';
import { ApiClientError } from '@shopsphere/api-client';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ControlledTextInput, ControlledSelect } from '../../components/ui/ControlledField';
import { useToast } from '../../components/ui/ToastProvider';

type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export function CategoriesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: () => api.catalog.listCategories()
  });

  const { control, handleSubmit, reset, formState } = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: '', slug: '', description: '' }
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateCategoryInput) => api.admin.createCategory(values),
    onSuccess: () => {
      showToast('Category created', 'success');
      queryClient.invalidateQueries({ queryKey: ['catalog', 'categories'] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err) => showToast(err instanceof ApiClientError ? err.message : 'Failed to create category', 'error')
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Categories</h1>
        <Button onClick={() => setIsModalOpen(true)}>New category</Button>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (r) => r.name },
          { key: 'slug', header: 'Slug', render: (r) => r.slug },
          { key: 'parentId', header: 'Parent', render: (r) => r.parentId ?? '—' },
          { key: 'description', header: 'Description', render: (r) => r.description ?? '—' }
        ]}
        rows={data ?? []}
        getRowKey={(r) => r.id}
        isLoading={isLoading}
        error={error instanceof ApiClientError ? error.message : error ? 'Failed to load categories' : null}
        onRetry={refetch}
        emptyTitle="No categories yet"
      />

      <Modal title="New category" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          noValidate
        >
          <ControlledTextInput name="name" control={control} label="Name" required />
          <ControlledTextInput name="slug" control={control} label="Slug" required hint="URL-safe identifier, e.g. home-and-garden" />
          <ControlledSelect name="parentId" control={control} label="Parent category">
            <option value="">No parent</option>
            {(data ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </ControlledSelect>
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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CategorySection } from '@/components/services/CategorySection';
import { CategoryForm } from '@/components/services/CategoryForm';
import { apiClient } from '@/lib/api-client';

export function ServicesPage() {
  const queryClient = useQueryClient();
  const [addingCategory, setAddingCategory] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => apiClient.listServiceCategories(),
  });

  const servicesQuery = useQuery({
    queryKey: ['service-items'],
    queryFn: () => apiClient.listServiceItems(),
  });

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['service-categories'] });
    queryClient.invalidateQueries({ queryKey: ['service-items'] });
  };

  // Category mutations
  const createCategory = useMutation({
    mutationFn: apiClient.createServiceCategory,
    onSuccess: () => {
      invalidate();
      setAddingCategory(false);
      showSuccess('Category created');
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description: string | null }) =>
      apiClient.updateServiceCategory(id, data),
    onSuccess: () => {
      invalidate();
      showSuccess('Category updated');
    },
  });

  const deleteCategory = useMutation({
    mutationFn: apiClient.deactivateServiceCategory,
    onSuccess: () => {
      invalidate();
      showSuccess('Category removed');
    },
  });

  // Service mutations
  const createService = useMutation({
    mutationFn: apiClient.createServiceItem,
    onSuccess: () => {
      invalidate();
      showSuccess('Service added');
    },
  });

  const updateService = useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      apiClient.updateServiceItem(id, data),
    onSuccess: () => {
      invalidate();
      showSuccess('Service updated');
    },
  });

  const deleteService = useMutation({
    mutationFn: apiClient.deactivateServiceItem,
    onSuccess: () => {
      invalidate();
      showSuccess('Service removed');
    },
  });

  const isSaving =
    createCategory.isPending ||
    updateCategory.isPending ||
    deleteCategory.isPending ||
    createService.isPending ||
    updateService.isPending ||
    deleteService.isPending;

  if (categoriesQuery.isLoading || servicesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (categoriesQuery.error || servicesQuery.error) {
    return (
      <div className="text-destructive">Failed to load services. Please try again.</div>
    );
  }

  const categories = categoriesQuery.data ?? [];
  const services = servicesQuery.data ?? [];

  // Group services by categoryId
  const servicesByCategory = new Map<string, typeof services>();
  for (const svc of services) {
    const list = servicesByCategory.get(svc.categoryId) ?? [];
    list.push(svc);
    servicesByCategory.set(svc.categoryId, list);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="services-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your service catalog and pricing.
          </p>
        </div>
        <Button onClick={() => setAddingCategory(true)} disabled={addingCategory}>
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          {successMessage}
        </div>
      )}

      {/* Add category form */}
      {addingCategory && (
        <CategoryForm
          onSave={(data) => createCategory.mutate(data)}
          onCancel={() => setAddingCategory(false)}
          saving={createCategory.isPending}
        />
      )}

      {/* Category sections */}
      {categories.length === 0 && !addingCategory ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center" data-testid="empty-state">
          <Wrench className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No categories yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first category to start building your service catalog.
          </p>
          <Button className="mt-4" onClick={() => setAddingCategory(true)}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      ) : (
        categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            services={servicesByCategory.get(category.id) ?? []}
            onEditCategory={(data) => updateCategory.mutate({ id: category.id, ...data })}
            onDeleteCategory={() => {
              if (window.confirm(`Remove "${category.name}" and all its services?`)) {
                deleteCategory.mutate(category.id);
              }
            }}
            onAddService={(data) => createService.mutate({ ...data, unitType: data.unitType as 'flat' | 'hourly' | 'per_sqft' | 'per_unit' | 'per_visit' })}
            onEditService={(serviceId, data) => updateService.mutate({ id: serviceId, ...data })}
            onDeleteService={(serviceId) => {
              if (window.confirm('Remove this service?')) {
                deleteService.mutate(serviceId);
              }
            }}
            saving={isSaving}
          />
        ))
      )}
    </div>
  );
}

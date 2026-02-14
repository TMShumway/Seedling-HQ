import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServiceItemRow } from './ServiceItemRow';
import { ServiceItemForm } from './ServiceItemForm';
import { CategoryForm } from './CategoryForm';
import type { ServiceCategoryResponse, ServiceItemResponse } from '@/lib/api-types';

interface CategorySectionProps {
  category: ServiceCategoryResponse;
  services: ServiceItemResponse[];
  onEditCategory: (data: { name: string; description: string | null }) => void;
  onDeleteCategory: () => void;
  onAddService: (data: {
    categoryId: string;
    name: string;
    description: string | null;
    unitPrice: number;
    unitType: string;
    estimatedDurationMinutes: number | null;
  }) => void;
  onEditService: (
    serviceId: string,
    data: {
      name?: string;
      description?: string | null;
      unitPrice?: number;
      unitType?: string;
      estimatedDurationMinutes?: number | null;
    },
  ) => void;
  onDeleteService: (serviceId: string) => void;
  saving?: boolean;
}

export function CategorySection({
  category,
  services,
  onEditCategory,
  onDeleteCategory,
  onAddService,
  onEditService,
  onDeleteService,
  saving,
}: CategorySectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingCategory, setEditingCategory] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm" data-testid="category-section">
      {/* Category header */}
      {editingCategory ? (
        <div className="p-4">
          <CategoryForm
            initialData={{ name: category.name, description: category.description }}
            onSave={(data) => {
              onEditCategory(data);
              setEditingCategory(false);
            }}
            onCancel={() => setEditingCategory(false)}
            saving={saving}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between p-4">
          <div
            className="flex flex-1 cursor-pointer items-center gap-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <h3 className="text-base font-semibold">{category.name}</h3>
              {category.description && (
                <p className="text-sm text-muted-foreground">{category.description}</p>
              )}
            </div>
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {services.length} {services.length === 1 ? 'service' : 'services'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditingCategory(true)}
              aria-label="Edit category"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDeleteCategory}
              aria-label="Delete category"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Services list */}
      {expanded && (
        <div className="space-y-2 px-4 pb-4">
          {services.map((service) =>
            editingServiceId === service.id ? (
              <ServiceItemForm
                key={service.id}
                initialData={service}
                categoryId={category.id}
                onSave={(data) => {
                  onEditService(service.id, data);
                  setEditingServiceId(null);
                }}
                onCancel={() => setEditingServiceId(null)}
                saving={saving}
              />
            ) : (
              <ServiceItemRow
                key={service.id}
                item={service}
                onEdit={() => setEditingServiceId(service.id)}
                onDelete={() => onDeleteService(service.id)}
              />
            ),
          )}

          {addingService ? (
            <ServiceItemForm
              categoryId={category.id}
              onSave={(data) => {
                onAddService(data);
                setAddingService(false);
              }}
              onCancel={() => setAddingService(false)}
              saving={saving}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => setAddingService(true)}
              data-testid="add-service-btn"
            >
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

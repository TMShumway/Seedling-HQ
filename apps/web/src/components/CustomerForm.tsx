import { useState, FormEvent } from 'react';
import { useCreateCustomer } from '@seedling-hq/api';
import type { CreateCustomerRequest } from '@seedling-hq/types';

export function CustomerForm() {
  const [formData, setFormData] = useState<CreateCustomerRequest>({
    email: '',
    name: '',
    phoneNumber: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const createCustomerMutation = useCreateCustomer();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters long';
    }

    // Phone validation (optional)
    if (formData.phoneNumber && formData.phoneNumber.trim()) {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
      if (!phoneRegex.test(formData.phoneNumber.trim())) {
        newErrors.phoneNumber = 'Please enter a valid phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const submitData: CreateCustomerRequest = {
        email: formData.email.trim(),
        name: formData.name.trim(),
        phoneNumber: formData.phoneNumber?.trim() || undefined,
      };

      await createCustomerMutation.mutateAsync(submitData);
      
      // Reset form on success
      setFormData({ email: '', name: '', phoneNumber: '' });
      setErrors({});
      
    } catch (error) {
      console.error('Failed to create customer:', error);
      // Error is handled by TanStack Query and can be displayed via mutation.error
    }
  };

  const handleInputChange = (field: keyof CreateCustomerRequest) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({
        ...prev,
        [field]: e.target.value
      }));
      
      // Clear error when user starts typing
      if (errors[field]) {
        setErrors(prev => ({
          ...prev,
          [field]: ''
        }));
      }
    };

  return (
    <div className="customer-form">
      <h2>Add New Customer</h2>
      
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="email">
            Email <span className="required">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange('email')}
            className={errors.email ? 'error' : ''}
            disabled={createCustomerMutation.isPending}
            placeholder="john.doe@example.com"
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="name">
            Name <span className="required">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={handleInputChange('name')}
            className={errors.name ? 'error' : ''}
            disabled={createCustomerMutation.isPending}
            placeholder="John Doe"
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="phoneNumber">Phone Number</label>
          <input
            id="phoneNumber"
            type="tel"
            value={formData.phoneNumber}
            onChange={handleInputChange('phoneNumber')}
            className={errors.phoneNumber ? 'error' : ''}
            disabled={createCustomerMutation.isPending}
            placeholder="+1-555-0123"
          />
          {errors.phoneNumber && <span className="error-message">{errors.phoneNumber}</span>}
        </div>

        <button 
          type="submit" 
          disabled={createCustomerMutation.isPending}
          className="submit-button"
        >
          {createCustomerMutation.isPending ? 'Adding...' : 'Add Customer'}
        </button>

        {createCustomerMutation.error && (
          <div className="error-message">
            Error: {createCustomerMutation.error.message}
          </div>
        )}

        {createCustomerMutation.isSuccess && (
          <div className="success-message">
            Customer added successfully!
          </div>
        )}
      </form>
    </div>
  );
}

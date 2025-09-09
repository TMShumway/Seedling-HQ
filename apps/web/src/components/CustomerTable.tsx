import { useCustomers } from '@seedling-hq/api';
import type { Customer } from '@seedling-hq/types';

interface CustomerRowProps {
  customer: Customer;
}

function CustomerRow({ customer }: CustomerRowProps) {
  return (
    <tr>
      <td>{customer.id}</td>
      <td>{customer.name}</td>
      <td>
        <a href={`mailto:${customer.email}`}>{customer.email}</a>
      </td>
      <td>{customer.phoneNumber || '-'}</td>
      <td>{new Date(customer.createdAt).toLocaleDateString()}</td>
      <td>
        <span className={customer.isActive ? 'active' : 'inactive'}>
          {customer.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
    </tr>
  );
}

export function CustomerTable() {
  const { data: response, isLoading, error, refetch } = useCustomers();
  const customers = response?.data?.customers || [];

  if (isLoading) {
    return (
      <div className="customer-table">
        <h2>Customers</h2>
        <div className="loading">
          <p>Loading customers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-table">
        <h2>Customers</h2>
        <div className="error">
          <p>Error loading customers: {error.message}</p>
          <button onClick={() => refetch()} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const hasCustomers = customers.length > 0;

  return (
    <div className="customer-table">
      <h2>Customers ({customers.length})</h2>
      
      {!hasCustomers ? (
        <div className="empty-state">
          <p>No customers found. Add your first customer using the form above!</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Created</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <CustomerRow key={customer.id} customer={customer} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-actions">
        <button onClick={() => refetch()} className="refresh-button">
          Refresh
        </button>
      </div>
    </div>
  );
}

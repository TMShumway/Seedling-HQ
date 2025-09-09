import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { configureApiFactory } from '@seedling-hq/api';
import { CustomerForm, CustomerTable } from './components';
import './App.css'

// Configure the API factory for backend communication
configureApiFactory({
  baseUrl: 'http://localhost:3001/dev', // Serverless offline endpoint
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <header className="app-header">
          <h1>Seedling HQ - Customer Management</h1>
          <p>Add and manage customers for your business</p>
        </header>
        
        <main className="app-main">
          <div className="container">
            <section className="form-section">
              <CustomerForm />
            </section>
            
            <section className="table-section">
              <CustomerTable />
            </section>
          </div>
        </main>
        
        <footer className="app-footer">
          <p>&copy; 2024 Seedling HQ. Built with React + TanStack Query.</p>
        </footer>
      </div>
      
      {/* React Query DevTools */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

export default App

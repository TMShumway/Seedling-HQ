import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/app-shell/AppShell';
import { SignupPage } from '@/pages/SignupPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { ClientDetailPage } from '@/pages/ClientDetailPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { RequestDetailPage } from '@/pages/RequestDetailPage';
import { ConvertRequestPage } from '@/pages/ConvertRequestPage';
import { QuotesPage } from '@/pages/QuotesPage';
import { CreateQuotePage } from '@/pages/CreateQuotePage';
import { QuoteDetailPage } from '@/pages/QuoteDetailPage';
import { PublicRequestPage } from '@/pages/PublicRequestPage';
import { RequestSuccessPage } from '@/pages/RequestSuccessPage';
import { PublicQuoteViewPage } from '@/pages/PublicQuoteViewPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/request/:tenantSlug" element={<PublicRequestPage />} />
          <Route path="/request/:tenantSlug/success" element={<RequestSuccessPage />} />
          <Route path="/quote/:token" element={<PublicQuoteViewPage />} />
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/requests/:id" element={<RequestDetailPage />} />
            <Route path="/requests/:id/convert" element={<ConvertRequestPage />} />
            <Route path="/quotes" element={<QuotesPage />} />
            <Route path="/quotes/new" element={<CreateQuotePage />} />
            <Route path="/quotes/:id" element={<QuoteDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

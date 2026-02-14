import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import type { ConvertRequestPayload, ClientResponse } from '@/lib/api-types';

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const lastSpaceIdx = trimmed.lastIndexOf(' ');
  if (lastSpaceIdx === -1) {
    return { firstName: trimmed, lastName: '' };
  }
  return {
    firstName: trimmed.slice(0, lastSpaceIdx),
    lastName: trimmed.slice(lastSpaceIdx + 1),
  };
}

export function ConvertRequestPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const requestQuery = useQuery({
    queryKey: ['request', id],
    queryFn: () => apiClient.getRequest(id!),
    enabled: !!id,
  });

  const req = requestQuery.data;

  // Pre-fill form from request data
  const defaultNames = useMemo(() => {
    if (!req) return { firstName: '', lastName: '' };
    return splitName(req.clientName);
  }, [req]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [quoteTitle, setQuoteTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Client match state
  const [emailSearchTerm, setEmailSearchTerm] = useState('');
  const [matchedClients, setMatchedClients] = useState<ClientResponse[]>([]);
  const [selectedExistingClientId, setSelectedExistingClientId] = useState<string | null>(null);

  // Initialize form when request data loads
  useEffect(() => {
    if (req) {
      setFirstName(defaultNames.firstName);
      setLastName(defaultNames.lastName);
      setEmail(req.clientEmail);
      setPhone(req.clientPhone ?? '');
      setQuoteTitle(`Service for ${req.clientName}`);
      setEmailSearchTerm(req.clientEmail);
    }
  }, [req, defaultNames]);

  // Debounced email search for existing client match
  useEffect(() => {
    if (!emailSearchTerm || emailSearchTerm.length < 3) {
      setMatchedClients([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await apiClient.listClients({ search: emailSearchTerm, limit: 5 });
        setMatchedClients(result.data);
      } catch {
        setMatchedClients([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [emailSearchTerm]);

  const convertMutation = useMutation({
    mutationFn: (payload: ConvertRequestPayload) =>
      apiClient.convertRequest(id!, payload),
    onSuccess: (result) => {
      navigate(`/quotes/${result.quote.id}`);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleConvert = () => {
    setError(null);
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!addressLine1.trim()) {
      setError('Address is required');
      return;
    }
    if (!quoteTitle.trim()) {
      setError('Quote title is required');
      return;
    }

    convertMutation.mutate({
      existingClientId: selectedExistingClientId ?? undefined,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      company: company.trim() || null,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip: zip.trim() || null,
      quoteTitle: quoteTitle.trim(),
    });
  };

  if (requestQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="convert-request-page">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (requestQuery.error || !req) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="convert-request-page">
        <Button variant="ghost" onClick={() => navigate('/requests')} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Requests
        </Button>
        <div className="text-destructive">Request not found.</div>
      </div>
    );
  }

  if (req.status !== 'new' && req.status !== 'reviewed') {
    return (
      <div className="mx-auto max-w-3xl" data-testid="convert-request-page">
        <Button variant="ghost" onClick={() => navigate(`/requests/${id}`)} className="mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Request
        </Button>
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This request has already been {req.status} and cannot be converted.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="convert-request-page">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(`/requests/${id}`)} size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Request
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Convert Request</h1>
        <p className="mt-1 text-muted-foreground">
          Create a client, property, and quote draft from this request.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Existing client match */}
      {matchedClients.length > 0 && !selectedExistingClientId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing Client Match</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              We found existing clients that may match. Select one or create a new client.
            </p>
            <div className="space-y-2">
              {matchedClients.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                >
                  <input
                    type="radio"
                    name="existingClient"
                    value={c.id}
                    checked={selectedExistingClientId === c.id}
                    onChange={() => setSelectedExistingClientId(c.id)}
                    className="h-4 w-4"
                  />
                  <div>
                    <div className="text-sm font-medium">{c.firstName} {c.lastName}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </div>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent">
                <input
                  type="radio"
                  name="existingClient"
                  value=""
                  checked={selectedExistingClientId === null}
                  onChange={() => setSelectedExistingClientId(null)}
                  className="h-4 w-4"
                />
                <div className="text-sm font-medium">Create new client</div>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client section */}
      {!selectedExistingClientId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="text-sm font-medium">
                  First Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="convert-firstName"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="text-sm font-medium">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="convert-lastName"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailSearchTerm(e.target.value);
                  }}
                  data-testid="convert-email"
                />
              </div>
              <div>
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone
                </label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="convert-phone"
                />
              </div>
            </div>
            <div>
              <label htmlFor="company" className="text-sm font-medium">
                Company
              </label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                data-testid="convert-company"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Property section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Service Property</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label htmlFor="addressLine1" className="text-sm font-medium">
              Address <span className="text-destructive">*</span>
            </label>
            <Input
              id="addressLine1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Street address"
              data-testid="convert-addressLine1"
            />
          </div>
          <div>
            <label htmlFor="addressLine2" className="text-sm font-medium">
              Address Line 2
            </label>
            <Input
              id="addressLine2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Apt, suite, unit, etc."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="city" className="text-sm font-medium">
                City
              </label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                data-testid="convert-city"
              />
            </div>
            <div>
              <label htmlFor="state" className="text-sm font-medium">
                State
              </label>
              <Input
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                data-testid="convert-state"
              />
            </div>
            <div>
              <label htmlFor="zip" className="text-sm font-medium">
                ZIP
              </label>
              <Input
                id="zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                data-testid="convert-zip"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote title */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quote</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label htmlFor="quoteTitle" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="quoteTitle"
              value={quoteTitle}
              onChange={(e) => setQuoteTitle(e.target.value)}
              data-testid="convert-quoteTitle"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(`/requests/${id}`)}
          disabled={convertMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConvert}
          disabled={convertMutation.isPending}
          data-testid="convert-submit"
        >
          {convertMutation.isPending ? 'Converting...' : 'Convert to Client'}
        </Button>
      </div>
    </div>
  );
}

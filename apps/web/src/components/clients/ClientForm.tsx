import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CreateClientRequest, UpdateClientRequest, ClientResponse } from '@/lib/api-types';

interface ClientFormProps {
  client?: ClientResponse;
  onSave: (data: CreateClientRequest | UpdateClientRequest) => void;
  onCancel: () => void;
  saving?: boolean;
}

export function ClientForm({ client, onSave, onCancel, saving }: ClientFormProps) {
  const [firstName, setFirstName] = useState(client?.firstName ?? '');
  const [lastName, setLastName] = useState(client?.lastName ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [company, setCompany] = useState(client?.company ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [tagsInput, setTagsInput] = useState(client?.tags?.join(', ') ?? '');

  const handleSave = () => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      company: company.trim() || null,
      notes: notes.trim() || null,
      tags,
    });
  };

  const isValid = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <Card data-testid="client-form">
      <CardHeader>
        <CardTitle>{client ? 'Edit Client' : 'Add Client'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes..."
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="residential, weekly (comma-separated)"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {client ? 'Update' : 'Add Client'}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

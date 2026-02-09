import { useNavigate } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Mail, Building2, ChevronRight } from 'lucide-react';
import type { ClientResponse } from '@/lib/api-client';
import { formatClientName } from '@/lib/format';

interface ClientCardProps {
  client: ClientResponse;
}

export function ClientCard({ client }: ClientCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/clients/${client.id}`)}
      data-testid="client-card"
    >
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {client.firstName[0]}{client.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{formatClientName(client.firstName, client.lastName)}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {client.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {client.email}
              </span>
            )}
            {client.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {client.phone}
              </span>
            )}
            {client.company && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {client.company}
              </span>
            )}
          </div>
          {client.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {client.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

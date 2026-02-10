export interface RespondToQuoteInput {
  tenantId: string;
  quoteId: string;
  tokenId: string;
  action: 'approve' | 'decline';
}

export interface RespondToQuoteOutput {
  quote: {
    id: string;
    status: string;
    approvedAt: string | null;
    declinedAt: string | null;
  };
}

type TicketFactCount = {
  provider: string;
  refundedTickets: number;
  soldTickets: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  style: "currency",
});

export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatSyncDelay(seconds: number): string {
  if (seconds === 0) {
    return "Current";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes === 0) {
    return `${remainder}s behind`;
  }

  return `${minutes}m ${remainder}s behind`;
}

export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "No successful update";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

export function sumProviderTicketFacts(facts: TicketFactCount[]): number {
  return facts.reduce(
    (total, fact) => total + fact.soldTickets - fact.refundedTickets,
    0,
  );
}

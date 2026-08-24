export type UsdMoney = {
  cents: number;
  currency: "USD";
};

function assertIntegerCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Money must use safe integer cents");
  }
}

export function usd(cents: number): UsdMoney {
  assertIntegerCents(cents);

  return { cents, currency: "USD" };
}

export function parseUsdMoney(value: {
  cents: number;
  currency: string;
}): UsdMoney {
  if (value.currency !== "USD") {
    throw new Error("Money currency must be USD");
  }

  return usd(value.cents);
}

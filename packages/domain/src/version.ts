import type { Provider } from "@prism/contracts";

function compareStrings(left: string, right: string): -1 | 0 | 1 {
  if (left === right) {
    return 0;
  }

  return left > right ? 1 : -1;
}

function compareTimestamps(left: string, right: string): -1 | 0 | 1 {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    throw new Error("Provider timestamp version must be an ISO timestamp");
  }

  if (leftTime === rightTime) {
    return 0;
  }

  return leftTime > rightTime ? 1 : -1;
}

function compareBigIntRanks(left: string, right: string): -1 | 0 | 1 {
  let leftRank: bigint;
  let rightRank: bigint;

  try {
    leftRank = BigInt(left);
    rightRank = BigInt(right);
  } catch {
    throw new Error("BoxGrid version must be a bigint string");
  }

  if (leftRank === rightRank) {
    return 0;
  }

  return leftRank > rightRank ? 1 : -1;
}

export function compareProviderVersion(
  provider: Provider,
  left: string,
  right: string,
): -1 | 0 | 1 {
  if (provider === "encoretix") {
    return compareTimestamps(left, right);
  }

  if (provider === "boxgrid") {
    return compareBigIntRanks(left, right);
  }

  return compareStrings(left, right);
}

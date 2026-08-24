export type Performance = {
  name: string;
  startsAt: string;
  venueName: string;
};

export type ShowCandidate = Performance & {
  showId: string;
};

export type EventMatch =
  | { confidence: number; showId: string; state: "matched" }
  | { confidence: number; state: "ambiguous" }
  | { confidence: 0; state: "unmatched" };

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function scorePerformance(
  performance: Performance,
  candidate: ShowCandidate,
): number {
  const sameName =
    normalizeText(performance.name) === normalizeText(candidate.name);
  const sameVenue =
    normalizeText(performance.venueName) === normalizeText(candidate.venueName);
  const sameStart = performance.startsAt === candidate.startsAt;

  return (sameName ? 0.5 : 0) + (sameVenue ? 0.3 : 0) + (sameStart ? 0.2 : 0);
}

export function scoreEventMatch(
  performance: Performance,
  candidates: ShowCandidate[],
): EventMatch {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scorePerformance(performance, candidate),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.showId.localeCompare(right.candidate.showId),
    );
  const best = scored[0];

  if (!best || best.score < 0.8) {
    return { confidence: 0, state: "unmatched" };
  }

  if (scored[1]?.score === best.score) {
    return { confidence: best.score, state: "ambiguous" };
  }

  return {
    confidence: best.score,
    showId: best.candidate.showId,
    state: "matched",
  };
}

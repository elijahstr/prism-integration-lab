import type { VenueWavePayload } from "./schema";

export type VenueWavePage = VenueWavePayload & {
  cursor: string | null;
};

export type VenueWavePollControl =
  | { error: string; type: "temporary_failure" }
  | { retryAfterSeconds: number; type: "rate_limited" };

export type VenueWavePollResponse = VenueWavePage | VenueWavePollControl;

export class VenueWaveClient {
  constructor(private readonly pages: VenueWavePage[]) {}

  getPage(cursor: string | null): VenueWavePage | undefined {
    return this.pages.find((page) => page.cursor === cursor);
  }
}

export class VenueWaveSequenceClient {
  private index = 0;

  constructor(private readonly responses: VenueWavePollResponse[]) {}

  getPage(_cursor: string | null): VenueWavePollResponse | undefined {
    const response = this.responses[this.index];
    this.index += 1;
    return response;
  }
}

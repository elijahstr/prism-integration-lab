import type { VenueWavePayload } from "./schema";

export type VenueWavePage = VenueWavePayload & {
  cursor: string | null;
};

export class VenueWaveClient {
  constructor(private readonly pages: VenueWavePage[]) {}

  getPage(cursor: string | null): VenueWavePage | undefined {
    return this.pages.find((page) => page.cursor === cursor);
  }
}

import { describe, expect, test } from "bun:test";

import {
  BoxGridClient,
  VenueWaveClient,
  encoreTixAdapter,
  verifyEncoreSignature,
} from "@prism/providers";

describe("provider package public interface", () => {
  test("exports the provider clients and signature verifier", () => {
    expect(new VenueWaveClient([]).getPage(null)).toBeUndefined();
    expect(
      new BoxGridClient({
        complete: false,
        facts: { grossSalesCents: 0, inventory: 0, sold: 0 },
        sequence: "0",
      }).getSnapshot().complete,
    ).toBe(false);
    expect(
      verifyEncoreSignature(
        new TextEncoder().encode("payload"),
        "not-a-signature",
        "secret",
      ),
    ).toBe(false);
    expect(
      encoreTixAdapter.compareVersion(
        "2026-08-25T00:00:00.000Z",
        "2026-08-24T00:00:00.000Z",
      ),
    ).toBe(1);
  });
});

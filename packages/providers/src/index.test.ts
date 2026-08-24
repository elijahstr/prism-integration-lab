import { describe, expect, test } from "bun:test";

import {
  BoxGridClient,
  VenueWaveClient,
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
    expect(verifyEncoreSignature("payload", "not-a-signature", "secret")).toBe(
      false,
    );
  });
});

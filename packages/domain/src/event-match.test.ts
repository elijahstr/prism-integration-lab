import { describe, expect, test } from "bun:test";

import { scoreEventMatch } from "./event-match";

const performance = {
  name: "Summer Hall",
  startsAt: "2026-08-24T20:00:00.000Z",
  venueName: "The Harbor Room",
};

describe("event matching", () => {
  test("selects one exact performance match", () => {
    expect(
      scoreEventMatch(performance, [
        {
          name: "Summer Hall",
          showId: "show-summer-hall",
          startsAt: "2026-08-24T20:00:00.000Z",
          venueName: "The Harbor Room",
        },
        {
          name: "Other Hall",
          showId: "show-other-hall",
          startsAt: "2026-08-24T20:00:00.000Z",
          venueName: "The Harbor Room",
        },
      ]),
    ).toEqual({ confidence: 1, showId: "show-summer-hall", state: "matched" });
  });

  test("does not select either of two equally strong performances", () => {
    expect(
      scoreEventMatch(performance, [
        {
          name: "Summer Hall",
          showId: "show-a",
          startsAt: "2026-08-24T20:00:00.000Z",
          venueName: "The Harbor Room",
        },
        {
          name: "Summer Hall",
          showId: "show-b",
          startsAt: "2026-08-24T20:00:00.000Z",
          venueName: "The Harbor Room",
        },
      ]),
    ).toEqual({ confidence: 1, state: "ambiguous" });
  });
});

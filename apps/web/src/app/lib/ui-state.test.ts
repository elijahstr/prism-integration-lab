import { describe, expect, test } from "bun:test";

import {
  actionErrorMessage,
  focusActionResult,
  unavailableSessionMessage,
} from "./ui-state";

describe("action feedback", () => {
  test("keeps an action error visible after dashboard data has loaded", () => {
    expect(actionErrorMessage("The replay failed.")).toBe("The replay failed.");
  });

  test("selects the stable main region as the action focus target", () => {
    let focusCalls = 0;
    const target = {
      focus: () => {
        focusCalls += 1;
      },
    };

    focusActionResult({
      getElementById: (id) => (id === "main-content" ? target : null),
    });

    expect(focusCalls).toBe(1);
  });

  test("uses the visible unavailable-session message for a reset with no token", () => {
    expect(unavailableSessionMessage(null)).toBe(
      "The lab session is unavailable. Reload this page.",
    );
  });
});

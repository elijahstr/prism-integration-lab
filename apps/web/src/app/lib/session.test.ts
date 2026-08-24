import { describe, expect, test } from "bun:test";

import {
  LabSessionExpiredError,
  clearLabToken,
  readLabToken,
  readWithLabSession,
  writeLabToken,
} from "./session";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("lab token storage", () => {
  test("writes and reads only the current lab token", () => {
    const storage = memoryStorage();

    writeLabToken(storage, "token-123");

    expect(readLabToken(storage)).toBe("token-123");
  });

  test("rejects an empty stored token and clears it", () => {
    const storage = memoryStorage({ "prism.integration-lab.session.v1": "" });

    expect(readLabToken(storage)).toBeNull();
    expect(storage.getItem("prism.integration-lab.session.v1")).toBeNull();
  });

  test("clears a stored lab token", () => {
    const storage = memoryStorage({
      "prism.integration-lab.session.v1": "token-123",
    });

    clearLabToken(storage);

    expect(readLabToken(storage)).toBeNull();
  });

  test("replaces one expired token once and does not retry the replacement", async () => {
    const storage = memoryStorage({
      "prism.integration-lab.session.v1": "expired-token",
    });
    const reads: string[] = [];
    let created = 0;

    await expect(
      readWithLabSession(
        storage,
        async () => {
          created += 1;
          return "replacement-token";
        },
        async (token) => {
          reads.push(token);
          if (token === "expired-token" || token === "replacement-token") {
            throw new LabSessionExpiredError();
          }
          return "unreachable";
        },
      ),
    ).rejects.toBeInstanceOf(LabSessionExpiredError);

    expect(created).toBe(1);
    expect(reads).toEqual(["expired-token", "replacement-token"]);
    expect(readLabToken(storage)).toBeNull();
  });
});

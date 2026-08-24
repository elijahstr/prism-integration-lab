export const labSessionStorageKey = "prism.integration-lab.session.v1";

export type SessionStorageLike = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

export class LabSessionExpiredError extends Error {
  constructor() {
    super("The lab session expired.");
  }
}

export function readLabToken(storage: SessionStorageLike): string | null {
  const token = storage.getItem(labSessionStorageKey);

  if (!token?.trim()) {
    storage.removeItem(labSessionStorageKey);
    return null;
  }

  return token;
}

export function writeLabToken(
  storage: SessionStorageLike,
  token: string,
): void {
  storage.setItem(labSessionStorageKey, token);
}

export function clearLabToken(storage: SessionStorageLike): void {
  storage.removeItem(labSessionStorageKey);
}

export async function readWithLabSession<T>(
  storage: SessionStorageLike,
  createToken: () => Promise<string>,
  read: (token: string) => Promise<T>,
): Promise<T> {
  const storedToken = readLabToken(storage);

  if (!storedToken) {
    const token = await createToken();
    writeLabToken(storage, token);
    return read(token);
  }

  try {
    return await read(storedToken);
  } catch (error) {
    if (!(error instanceof LabSessionExpiredError)) {
      throw error;
    }
  }

  clearLabToken(storage);
  const replacementToken = await createToken();
  writeLabToken(storage, replacementToken);

  try {
    return await read(replacementToken);
  } catch (error) {
    if (error instanceof LabSessionExpiredError) {
      clearLabToken(storage);
    }
    throw error;
  }
}

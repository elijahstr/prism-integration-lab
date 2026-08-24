const labSessionStoragePrefix = "prism.integration-lab.session.v1";

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

export function labSessionStorageKey(organizationSlug: string): string {
  return `${labSessionStoragePrefix}.${organizationSlug}`;
}

export function readLabToken(
  storage: SessionStorageLike,
  organizationSlug: string,
): string | null {
  const key = labSessionStorageKey(organizationSlug);
  const token = storage.getItem(key);

  if (!token?.trim()) {
    storage.removeItem(key);
    return null;
  }

  return token;
}

export function writeLabToken(
  storage: SessionStorageLike,
  organizationSlug: string,
  token: string,
): void {
  storage.setItem(labSessionStorageKey(organizationSlug), token);
}

export function clearLabToken(
  storage: SessionStorageLike,
  organizationSlug: string,
): void {
  storage.removeItem(labSessionStorageKey(organizationSlug));
}

export async function readWithLabSession<T>(
  storage: SessionStorageLike,
  organizationSlug: string,
  createToken: () => Promise<string>,
  read: (token: string) => Promise<T>,
): Promise<T> {
  const storedToken = readLabToken(storage, organizationSlug);

  if (!storedToken) {
    const token = await createToken();
    writeLabToken(storage, organizationSlug, token);
    return read(token);
  }

  try {
    return await read(storedToken);
  } catch (error) {
    if (!(error instanceof LabSessionExpiredError)) {
      throw error;
    }
  }

  clearLabToken(storage, organizationSlug);
  const replacementToken = await createToken();
  writeLabToken(storage, organizationSlug, replacementToken);

  try {
    return await read(replacementToken);
  } catch (error) {
    if (error instanceof LabSessionExpiredError) {
      clearLabToken(storage, organizationSlug);
    }
    throw error;
  }
}

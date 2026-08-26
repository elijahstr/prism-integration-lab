const requiredEnvironmentNames = [
  "DATABASE_URL",
  "LAB_TOKEN_PEPPER",
  "PROVIDER_KEY_MASTER_SECRET",
  "REDIS_URL",
] as const;

export function validatePublicEnvironment(
  environment: Record<string, string | undefined>,
): void {
  const missing = requiredEnvironmentNames.filter(
    (name) => !environment[name]?.trim(),
  );

  if (missing.length !== 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

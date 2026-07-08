/**
 * Environment variable validation.
 * Ensures that required runtime variables are set at boot time,
 * rather than failing later when they're actually needed.
 */

function validateEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Please set it in your .env file. See .env.example for reference.`,
    );
  }
  return value;
}

export function validateEnvVars() {
  // Required for all environments
  validateEnvVar('SESSION_SECRET', import.meta.env.SESSION_SECRET);
  validateEnvVar('NODEHIVE_BASE_URL', import.meta.env.NODEHIVE_BASE_URL);
  validateEnvVar('NODEHIVE_API_KEY', import.meta.env.NODEHIVE_API_KEY);
}

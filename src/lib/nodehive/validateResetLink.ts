function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

export interface ValidateResetLinkResult {
  valid: boolean;
  error?: string;
}

export async function validateResetLink(
  uid: string,
  timestamp: string,
  hash: string,
): Promise<ValidateResetLinkResult> {
  try {
    const url = `${getBaseUrl()}/api/nodehive/validate-reset-link?uid=${encodeURIComponent(uid)}&timestamp=${encodeURIComponent(timestamp)}&hash=${encodeURIComponent(hash)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (res.status === 200 && data?.valid === true) {
      return { valid: true };
    }
    return { valid: false, error: (data?.error as string) ?? (data?.message as string) ?? 'Invalid or expired link' };
  } catch {
    return { valid: false, error: 'Could not connect to server.' };
  }
}

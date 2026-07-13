/**
 * User profile service.
 * Uses the session's accessToken to fetch/update user data via Drupal REST.
 */

function getBaseUrl(): string {
  const url = import.meta.env.NODEHIVE_BASE_URL;
  if (!url) throw new Error('NODEHIVE_BASE_URL is not set');
  return url.replace(/\/$/, '');
}

export interface UserProfile {
  uid: string;
  name: string;
  mail: string;
}

export async function getUserProfile(uid: string, accessToken: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/user/${uid}?_format=json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const nameField = data?.name as Array<{ value: string }> | undefined;
    const mailField = data?.mail as Array<{ value: string }> | undefined;

    return {
      uid,
      name: nameField?.[0]?.value ?? '',
      mail: mailField?.[0]?.value ?? '',
    };
  } catch {
    return null;
  }
}

export async function updateUserProfile(
  uid: string,
  accessToken: string,
  data: { displayName?: string; mail?: string; currentPassword?: string; newPassword?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Build the PATCH payload for Drupal REST
    const fieldData: Record<string, Array<{ value: string }>> = {};

    if (data.displayName) {
      fieldData.name = [{ value: data.displayName }];
    }
    if (data.mail) {
      fieldData.mail = [{ value: data.mail }];
    }
    if (data.currentPassword) {
      fieldData.pass = [{ value: data.currentPassword }];
    }
    if (data.newPassword) {
      fieldData.pass = [{ value: data.newPassword }];
    }

    const res = await fetch(`${getBaseUrl()}/user/${uid}?_format=json`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _links: { type: { href: `${getBaseUrl()}/rest/type/user/user` } },
        ...fieldData,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
      return {
        ok: false,
        error: (errBody?.message as string) ?? `HTTP ${res.status}`,
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('[User] updateUserProfile error:', err);
    return { ok: false, error: 'No se pudo conectar con el servidor.' };
  }
}

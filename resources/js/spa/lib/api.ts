export type ApiError = {
    message: string;
    errors?: Record<string, string[]>;
};

const baseUrl = (import.meta.env.VITE_API_BASE as string) || '';

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers as Record<string, string> | undefined),
    };

    if (options.method && options.method.toUpperCase() !== 'GET') {
        const token = getCookie('XSRF-TOKEN');
        if (token) {
            headers['X-XSRF-TOKEN'] = decodeURIComponent(token);
        }
    }

    const response = await fetch(`${baseUrl}${path}`, {
        credentials: 'include',
        headers,
        ...options,
    });

    if (response.status === 419 && retry) {
        await csrf();
        return request<T>(path, options, false);
    }

    if (!response.ok) {
        let payload: ApiError = { message: 'Unbekannter Fehler.' };
        try {
            payload = await parseJsonResponse<ApiError>(response);
        } catch (error) {
            // ignore json parse errors
        }
        throw payload;
    }

    if (response.status === 204) {
        return {} as T;
    }

    return await parseJsonResponse<T>(response);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!text.trim()) {
        return {} as T;
    }
    try {
        return JSON.parse(text) as T;
    } catch {
        const extracted = extractLastJson(text);
        if (extracted !== null) {
            return extracted as T;
        }
        throw new Error('Invalid JSON response');
    }
}

function extractLastJson(text: string): unknown | null {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let start = -1;
    let lastSegment: string | null = null;

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === '{') {
            if (depth === 0) {
                start = i;
            }
            depth += 1;
            continue;
        }

        if (ch === '}') {
            if (depth > 0) {
                depth -= 1;
                if (depth === 0 && start !== -1) {
                    lastSegment = text.slice(start, i + 1);
                }
            }
        }
    }

    if (!lastSegment) {
        return null;
    }

    try {
        return JSON.parse(lastSegment) as unknown;
    } catch {
        return null;
    }
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? match[2] : null;
}

export async function csrf(): Promise<void> {
    await request('/sanctum/csrf-cookie', { method: 'GET' });
}

export async function login(username: string, password: string): Promise<{ user: UserPayload }> {
    await csrf();
    return request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function register(payload: {
    username: string;
    password: string;
    password_confirmation: string;
    email?: string;
}): Promise<{ user: UserPayload }> {
    await csrf();
    return request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function logout(): Promise<void> {
    await request('/api/auth/logout', { method: 'POST' });
}

export async function me(): Promise<UserPayload> {
    return request('/api/me');
}

export async function updateProfile(payload: {
    profile_ciphertext: string;
    profile_iv: string;
}): Promise<void> {
    await request('/api/me', {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function initVault(payload: {
    kdf_salt: string;
    kdf_params: Record<string, unknown>;
    encrypted_dek: string;
    dek_iv: string;
}): Promise<void> {
    await request('/api/vault/init', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function rotateVault(payload: {
    kdf_salt: string;
    kdf_params: Record<string, unknown>;
    encrypted_dek: string;
    dek_iv: string;
}): Promise<void> {
    await request('/api/vault/rotate', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export type UserPayload = {
    id: string;
    username: string;
    email: string | null;
    profile_ciphertext: string | null;
    profile_iv: string | null;
    vault: {
        kdf_salt: string | null;
        kdf_params: Record<string, unknown> | null;
        encrypted_dek: string | null;
        dek_iv: string | null;
    };
};

export type EntryPayload = {
    id: string;
    day: string;
    ciphertext: string;
    iv: string;
    aad: Record<string, unknown> | null;
    created_at: string | null;
    updated_at: string | null;
};

export async function listEntries(params?: { start?: string; end?: string }): Promise<EntryPayload[]> {
    const query = new URLSearchParams();
    if (params?.start) query.set('start', params.start);
    if (params?.end) query.set('end', params.end);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await request<{ entries: EntryPayload[] }>(`/api/entries${suffix}`);
    return response.entries;
}

export async function createEntry(payload: {
    day: string;
    ciphertext: string;
    iv: string;
    aad?: Record<string, unknown> | null;
}): Promise<EntryPayload> {
    const response = await request<{ entry: EntryPayload }>('/api/entries', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return response.entry;
}

export async function updateEntry(
    id: string,
    payload: {
        day?: string;
        ciphertext?: string;
        iv?: string;
        aad?: Record<string, unknown> | null;
    },
): Promise<EntryPayload> {
    const response = await request<{ entry: EntryPayload }>(`/api/entries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
    return response.entry;
}

export type PreferenceRecord = {
    ciphertext: string;
    iv: string;
};

export async function getPreferencesRecord(): Promise<PreferenceRecord | null> {
    const response = await request<{ preference: PreferenceRecord | null }>('/api/preferences');
    return response.preference;
}

export async function savePreferencesRecord(payload: PreferenceRecord): Promise<void> {
    await request('/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

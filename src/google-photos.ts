const PICKER_BASE = "https://photospicker.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export interface PickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  pollingConfig?: {
    pollInterval?: string;
    timeoutIn?: string;
  };
}

export interface PickedMediaItem {
  id: string;
  baseUrl?: string;
  mimeType?: string;
  mediaFile?: Record<string, unknown>;
  [key: string]: unknown;
}

async function getAccessToken(): Promise<string> {
  const direct = process.env.GOOGLE_PHOTOS_ACCESS_TOKEN;
  if (direct) return direct;

  if (
    !process.env.GOOGLE_PHOTOS_CLIENT_ID ||
    !process.env.GOOGLE_PHOTOS_CLIENT_SECRET ||
    !process.env.GOOGLE_PHOTOS_REFRESH_TOKEN
  ) {
    throw new Error(
      "Google Photos OAuth is not configured. Set GOOGLE_PHOTOS_ACCESS_TOKEN for development, or GOOGLE_PHOTOS_CLIENT_ID, GOOGLE_PHOTOS_CLIENT_SECRET, and GOOGLE_PHOTOS_REFRESH_TOKEN for persistent access."
    );
  }

  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_PHOTOS_CLIENT_ID,
    client_secret: process.env.GOOGLE_PHOTOS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_PHOTOS_REFRESH_TOKEN,
    grant_type: "refresh_token",
    scope: SCOPE,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google OAuth token refresh failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new Error("Google OAuth token response did not contain an access_token.");
  }

  cachedAccessToken = {
    token: payload.access_token,
    expiresAt: now + (payload.expires_in ?? 3600) * 1000,
  };

  return payload.access_token;
}

async function pickerRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${PICKER_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Photos Picker API error (${response.status}): ${details}`);
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function createPickerSession(): Promise<PickerSession> {
  return pickerRequest<PickerSession>("/sessions", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getPickerSession(sessionId: string): Promise<PickerSession> {
  return pickerRequest<PickerSession>(`/sessions/${encodeURIComponent(sessionId)}`);
}

export async function listPickedMediaItems(
  sessionId: string,
  pageSize = 100,
  pageToken?: string
): Promise<{ mediaItems: PickedMediaItem[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    sessionId,
    pageSize: String(Math.min(Math.max(pageSize, 1), 100)),
  });
  if (pageToken) params.set("pageToken", pageToken);

  return pickerRequest<{ mediaItems: PickedMediaItem[]; nextPageToken?: string }>(
    `/mediaItems?${params.toString()}`
  );
}

export async function deletePickerSession(sessionId: string): Promise<void> {
  await pickerRequest<Record<string, never>>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

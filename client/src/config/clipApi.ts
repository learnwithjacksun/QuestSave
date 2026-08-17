import api, { getApiError } from "@/config/api";
import type { AuthUser, ClipPreview, SavedClip, SharedClip } from "@/types/clip";

function apiOrigin() {
  return String(import.meta.env.VITE_BASE_URL || "").replace(/\/$/, "");
}

export async function resolveClip(url: string) {
  const { data } = await api.post<ClipPreview>("/api/clips/resolve", { url });
  return data;
}

export async function saveClip(payload: {
  url: string;
  platform: string;
  title: string;
  author: string;
  thumbnail: string;
  formatId?: string;
  mediaType: string;
}) {
  const { data } = await api.post("/api/clips/save", payload);
  return data;
}

export async function deleteClip(id: string) {
  await api.delete(`/api/clips/${id}`);
}

export async function downloadClipFile(url: string, formatId: string, title?: string) {
  try {
    const { data, headers } = await api.post(
      "/api/clips/download",
      { url, formatId, title },
      { responseType: "blob" }
    );

    const blob = data as Blob;
    const disposition = headers["content-disposition"] as string | undefined;
    const match = disposition?.match(/filename="([^"]+)"/);
    const filename = match?.[1] || "questsave-clip";

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    if (axiosErrorBlob(error)) {
      const message = await readBlobError(error);
      throw new Error(message);
    }
    throw new Error(getApiError(error, "Download failed"));
  }
}

export async function requestOtp(email: string, username?: string) {
  const { data } = await api.post<{
    exists?: boolean;
    needsUsername?: boolean;
    message?: string;
  }>("/api/auth/request-otp", { email, username });
  return data;
}

export async function verifyOtp(email: string, code: string, username?: string) {
  const { data } = await api.post<{ user: AuthUser }>("/api/auth/verify-otp", {
    email,
    code,
    username,
  });
  return data.user;
}

export async function fetchMe() {
  const { data } = await api.get<{ user: AuthUser | null }>("/api/auth/me");
  return data.user;
}

export async function logout() {
  await api.post("/api/auth/logout");
}

export async function fetchSavedClips() {
  const { data } = await api.get<{ clips: SavedClip[] }>("/api/clips");
  return data.clips;
}

export async function fetchReceivedShares() {
  const { data } = await api.get<{ shares: SharedClip[] }>("/api/shares/received");
  return data.shares;
}

export async function shareClip(clipId: string, username: string) {
  const { data } = await api.post<{ share: { id: string; username: string } }>(
    "/api/shares",
    { clipId, username }
  );
  return data.share;
}

export async function removeShare(shareId: string) {
  await api.delete(`/api/shares/${shareId}`);
}

export async function getPreviewStreamSrc(url: string, formatId: string) {
  const { data } = await api.get<{ path?: string; src?: string }>(
    "/api/clips/preview/stream-url",
    { params: { url, formatId } }
  );
  if (data.path) return `${apiOrigin()}${data.path}`;
  return data.src || "";
}

export async function getClipStreamSrc(clipId: string) {
  const { data } = await api.get<{ token?: string; src?: string }>(
    `/api/clips/${clipId}/stream-access`
  );
  if (data.token) {
    return `${apiOrigin()}/api/clips/${clipId}/stream?token=${encodeURIComponent(data.token)}`;
  }
  return data.src || "";
}

function axiosErrorBlob(error: unknown): error is { response: { data: Blob } } {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    Boolean((error as { response?: { data?: unknown } }).response?.data)
  );
}

async function readBlobError(error: { response: { data: Blob | object } }) {
  const data = error.response.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text()) as { message?: string };
      return json.message || "Download failed";
    } catch {
      return "Download failed";
    }
  }
  if (typeof data === "object" && data && "message" in data) {
    return String((data as { message: string }).message);
  }
  return "Download failed";
}

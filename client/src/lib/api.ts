/** Typed fetch wrapper. All API errors carry { error: string } and resolve to
 *  ApiError with the server's error code, so pages can show the right STRINGS
 *  entry. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: unknown,
  ) {
    super(code);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let code = "unknown_error";
  let detail: unknown;
  try {
    const body = await res.json();
    code = body.error ?? code;
    detail = body.detail;
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(res.status, code, detail);
}

export const apiGet = <T>(path: string) =>
  fetch(`/api${path}`, { credentials: "include" }).then((r) => handle<T>(r));

export const apiPost = <T>(path: string, body?: unknown) =>
  fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => handle<T>(r));

export const apiDelete = <T>(path: string) =>
  fetch(`/api${path}`, { method: "DELETE", credentials: "include" }).then((r) =>
    handle<T>(r),
  );

/** Full-path variants used by the identity pages (paths already include /api). */
export const api = <T>(path: string, init?: RequestInit) =>
  fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  }).then((r) => handle<T>(r));

export const post = <T>(path: string, data?: unknown) =>
  api<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

// src/utils/api.ts
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: 'include',   // REQUIRED — sends the httpOnly auth cookie cross-origin
  });

  if (res.status === 401) {
    // Backend's NotAuthenticatedException / InvalidCredentialsException always
    // return 401 — treat any 401 anywhere in the app as "session is invalid."
    window.location.href = '/login';
    throw new Error('Not authenticated'); // stops the calling function's .then chain
  }

  return res;
}
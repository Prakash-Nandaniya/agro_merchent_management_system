let navigateRef: ((path: string) => void) | null = null;

export function registerNavigate(fn: (path: string) => void) {
  navigateRef = fn;
}

function goToLogin() {
  if (navigateRef) {
    navigateRef('/login');
  } else {
    window.location.href = '/login';
  }
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;

  try {
    res = await fetch(input, {
      ...init,
      credentials: 'include',
    });
  } catch (networkError) {
    throw new Error(
      'Could not reach the server. Please check your connection and try again.'
    );
  }

  if (res.status === 401 || res.status === 403) {
    goToLogin();
    throw new Error('Not authenticated');
  }

  return res;
}
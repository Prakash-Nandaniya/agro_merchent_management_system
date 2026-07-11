let navigateRef: ((path: string) => void) | null = null;

export function registerNavigate(fn: (path: string) => void) {
  navigateRef = fn;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: 'include', 
  });
  console.log("hello there")
  if (res.status === 401) {
    if (navigateRef) {
      navigateRef('/login');
    } else {
      window.location.href = '/login';
    }
    throw new Error('Not authenticated'); 
  }

  return res;
}
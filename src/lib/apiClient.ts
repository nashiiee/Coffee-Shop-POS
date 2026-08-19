const API_URL = import.meta.env.VITE_API_URL

if (!API_URL) {
  throw new Error('VITE_API_URL is not set — copy .env.example to .env and configure it')
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  accessToken?: string | null
}

// Builds an absolute URL for a relative asset path the API returns (e.g. an
// uploaded product photo's imageUrl) so <img src> works regardless of which
// origin/port the frontend is served from.
export function apiAssetUrl(path: string): string {
  return `${API_URL}${path}`
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {}
  // Omit Content-Type for FormData — the browser must set it itself with the
  // multipart boundary; setting it manually breaks the upload.
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: isFormData ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errorPayload = payload as { error?: { code?: string; message?: string } } | null
    throw new ApiError(
      response.status,
      errorPayload?.error?.code ?? 'UNKNOWN_ERROR',
      errorPayload?.error?.message ?? 'Request failed',
    )
  }

  return payload as T
}

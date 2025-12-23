import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type { AuthResponse, ApiResponse } from '@/types';

// Use a relative '/api' base during development so the Vite proxy forwards
// requests to the backend and cookies are handled as same-origin. In
// production, allow an explicit VITE_API_URL to override the base.
const API_URL = (import.meta.env.DEV)
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'https://helpbuddyback.onrender.com/api');

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string | null> | null = null;
  // In-flight request dedupe map (keyed by METHOD + URL)
  private inflightRequests: Map<string, Promise<ApiResponse<any>>> = new Map();
  // Simple short-lived cache for idempotent GETs (used for /auth/me)
  private cache: Map<string, { ts: number; data: ApiResponse<any> }> = new Map();
  // global rate-limit/backoff timestamp (ms since epoch). When set, requests
  // will wait until this time before proceeding. Populated when the server
  // responds with 429 Too Many Requests and cleared automatically after expiry.
  private rateLimitUntil: number | null = null;
  // number of recent 429 events (used to increase backoff multiplier)
  private rateLimitCount = 0;
  private lastRateLimitAt = 0;

  constructor() {
    // NOTE: do NOT set a global Content-Type here. Some requests may use FormData
    // and the browser must set the boundary automatically. We'll set JSON Content-Type
    // on-demand in the request interceptor.
    this.client = axios.create({
      baseURL: API_URL,
      withCredentials: true,
    });

    // Debugging: log outgoing requests (sanitized) and responses
    this.client.interceptors.request.use(
      (config) => {
        try {
          // if body is plain object, set Content-Type to application/json
          const isFormData = config.data instanceof FormData;
          if (!isFormData && config.data && typeof config.data === 'object') {
            config.headers = config.headers || {};
            // only set when not already provided
            if (!('Content-Type' in config.headers)) {
              config.headers['Content-Type'] = 'application/json';
            }
          }

          // attach auth token if present
          const token = localStorage.getItem('accessToken');
          if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
          }

          // Lightweight console debugging (can be removed in prod)
          // Avoid printing large binary data
          const safeData = isFormData ? '[FormData]' : config.data;
           
          console.debug('[API REQUEST]', config.method, config.url, { headers: config.headers, data: safeData });
        } catch {
          // ignore logging errors
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: token refresh + logging
    this.client.interceptors.response.use(
      (response) => {
         
        console.debug('[API RESPONSE]', response.status, response.config.url, response.data);
        return response;
      },
  async (error: AxiosError) => {
        // log the error for debugging
         
        console.warn('[API ERROR]', error?.response?.status, error?.config?.url, error?.response?.data || error.message);

  const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // don't attempt refresh for refresh endpoint itself or if request is missing
        // If unauthorized or forbidden for the /auth/me endpoint, try a refresh once.
        const isAuthRefreshEndpoint = originalRequest && (originalRequest.url === `${API_URL}/auth/refresh` || (originalRequest.url && originalRequest.url.endsWith('/auth/refresh')));
        const isMeEndpoint = originalRequest && (originalRequest.url === `${API_URL}/auth/me` || (originalRequest.url && originalRequest.url.endsWith('/auth/me')));

        if (
          (error.response?.status === 401 || (error.response?.status === 403 && isMeEndpoint)) &&
          originalRequest &&
          !originalRequest._retry &&
          !isAuthRefreshEndpoint
        ) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.handleRefreshToken();
            if (newAccessToken) {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              return this.client(originalRequest);
            }
          } catch {
            // fall through to reject below
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async handleRefreshToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
    try {
  // Use a direct axios call for refresh to avoid hitting interceptors that may
  // rely on the access token. Ensure withCredentials so httpOnly cookie is sent.
  // Additionally, in dev we may have stored a refreshToken in localStorage
  // (fallback) so include it in the body if present. The server will prefer
  // the cookie but will accept the body value for local development.
  const body: Record<string, string> = {};
  const storedRefresh = localStorage.getItem('refreshToken');
  if (storedRefresh) body.refreshToken = storedRefresh;
  const response = await axios.post<AuthResponse>(`${API_URL}/auth/refresh`, body, { withCredentials: true });
        const { accessToken } = response.data?.data || {};

        if (accessToken) {
          localStorage.setItem('accessToken', accessToken);
          if (import.meta.env.DEV) {
            // Dev-only visibility for refresh lifecycle
             
            console.debug('[API][DEV] Access token refreshed via /auth/refresh');
          }
        }

        // update socket auth if present
        try {
           
          const { socketClient } = await import('@/api/socket');
          socketClient.connect(accessToken);
          if (import.meta.env.DEV) {
             
            console.debug('[API][DEV] socketClient.connect called after refresh');
          }
        } catch {
          // ignore if socket import fails
        }

        return accessToken ?? null;
        } catch {
          // Clear tokens and redirect to login
          localStorage.removeItem('accessToken');
          try {
            window.location.href = '/auth';
          } catch {
            // noop
          }
          return null;
        } finally {
        this.refreshPromise = null;
      }
  })();

    return this.refreshPromise;
  }

  // Generic request method with better error shaping
  async request<T>(method: string, url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const key = `${method.toUpperCase()} ${url}`;

    // If we're currently in a server-enforced backoff window due to previous
    // 429 responses, wait until the window expires before issuing the next
    // request. This prevents hammering the backend and reduces repeated 429s.
    if (this.rateLimitUntil && Date.now() < this.rateLimitUntil) {
      const now = Date.now();
      const waitBase = Math.max(0, this.rateLimitUntil - now);
      // add a small random jitter to avoid a thundering herd when backoff ends
      const jitter = Math.floor(Math.random() * 1500);
      const waitMs = waitBase + jitter;
      if (import.meta.env.DEV) console.debug('[API] rate-limited, waiting', waitMs, 'ms (including jitter', jitter, 'ms)');
      await new Promise((res) => setTimeout(res, waitMs));
    }

    // Short-circuit: if this is a GET request, attempt to return a cached
    // response (valid for a short window) to avoid spamming the backend
    // during rapid reloads or multiple simultaneous mounts.
    if (method.toUpperCase() === 'GET') {
      const cached = this.cache.get(key);
      const now = Date.now();
      // For /auth/me use 5 second cache, for /services/* use 3 second cache
      const cacheTTL = (url.endsWith('/auth/me') || url === '/auth/me') ? 5000 : 3000;
      if (cached && now - cached.ts < cacheTTL) {
        if (import.meta.env.DEV) console.debug('[API] returning cached response for', key);
        return cached.data as ApiResponse<T>;
      }

      // If a request is already in-flight for this key, return the same promise
      const existing = this.inflightRequests.get(key) as Promise<ApiResponse<T>> | undefined;
      if (existing) {
        if (import.meta.env.DEV) console.debug('[API] reusing in-flight request for', key);
        return existing;
      }
    }

    try {
      const promise = (async () => {
        try {
          const response = await this.client.request<ApiResponse<T>>({ method, url, data, ...(config || {}) });
          // cache GET responses briefly
          if (method.toUpperCase() === 'GET') {
            this.cache.set(key, { ts: Date.now(), data: response.data as ApiResponse<any> });
          }
          return response.data;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            // If backend responded with 429, set a short backoff window. Honor
            // the Retry-After header if present, otherwise use a conservative
            // default (5s instead of 2s to reduce hammering).
            const status = error.response?.status;
            if (status === 429) {
              const retryAfterHeader = (error.response?.headers as any)?.['retry-after'];
              let retryAfterMs = 5000; // Increased from 2000 to 5000
              if (retryAfterHeader) {
                const parsed = parseInt(String(retryAfterHeader), 10);
                if (!Number.isNaN(parsed) && parsed > 0) retryAfterMs = parsed * 1000;
              }

              // If we recently set a rate limit, increment the count to increase
              // the backoff multiplier. Otherwise reset.
              const since = Date.now() - this.lastRateLimitAt;
              if (since < 60_000) {
                this.rateLimitCount = Math.min(this.rateLimitCount + 1, 4); // Reduced max from 6 to 4
              } else {
                this.rateLimitCount = 1;
              }
              this.lastRateLimitAt = Date.now();

              // exponential-ish backoff factor, capped to avoid extremely long waits
              const factor = Math.min(Math.pow(2, this.rateLimitCount - 1), 8); // Reduced from 16 to 8
              const finalMs = Math.min(retryAfterMs * factor, 30_000); // Reduced max from 60s to 30s
              this.rateLimitUntil = Date.now() + finalMs;

              // Broadcast a short-lived event so UI components (pollers) can pause
              try {
                window.dispatchEvent(new CustomEvent('api:rate-limited', { detail: { until: this.rateLimitUntil, ms: finalMs } }));
              } catch {
                // ignore
              }

              if (import.meta.env.DEV) console.warn('[API] received 429, backing off for', finalMs, 'ms (factor', factor, ')');
            }

            // try to extract a useful server error; fall back to message
            const serverErr = (error.response && (error.response.data as { error?: string; message?: string })) || null;
            const message = serverErr?.error || serverErr?.message || error.message;
            return {
              success: false,
              error: message,
            } as ApiResponse<T>;
          }

          return {
            success: false,
            error: 'An unexpected error occurred',
          } as ApiResponse<T>;
        }
      })();

      // register in-flight tracker for dedupe (for all GET requests)
      if (method.toUpperCase() === 'GET') {
        this.inflightRequests.set(key, promise as Promise<ApiResponse<any>>);
        // ensure the entry is cleaned up when settled
        promise.finally(() => this.inflightRequests.delete(key));
      }

      return await promise;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // try to extract a useful server error; fall back to message
        const serverErr = (error.response && (error.response.data as { error?: string; message?: string })) || null;
        const message = serverErr?.error || serverErr?.message || error.message;
        return {
          success: false,
          error: message,
        };
      }

      return {
        success: false,
        error: 'An unexpected error occurred',
      };
    }
  }

  get<T>(url: string, config?: AxiosRequestConfig) {
    return this.request<T>('GET', url, undefined, config);
  }

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.request<T>('POST', url, data, config);
  }

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.request<T>('PUT', url, data, config);
  }

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.request<T>('DELETE', url, undefined, config);
  }

  async updateServiceLocation(serviceId: string, lat: number, lng: number) {
    return this.request('PATCH', `/services/${serviceId}/location`, { lat, lng });
  }

  async rateService(serviceId: string, rating: number, comment?: string) {
    return this.request('POST', `/services/${serviceId}/rate`, { rating, comment });
  }

  async getServiceRating(serviceId: string) {
    return this.request('GET', `/services/${serviceId}/rating`);
  }

  // Chat methods
  async getChatMessages(serviceId: string) {
    return this.request('GET', `/chat/service/${serviceId}/messages`);
  }

  async sendChatMessage(serviceId: string, data: {
    messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'TEMPLATE';
    messageText?: string;
  }) {
    return this.request('POST', `/chat/service/${serviceId}/messages`, data);
  }

  async markChatAsRead(serviceId: string) {
    return this.request('POST', `/chat/service/${serviceId}/mark-read`);
  }

  async getUnreadChatCount() {
    return this.request('GET', '/chat/unread-count');
  }

  async getChatTemplates() {
    return this.request('GET', '/chat/templates');
  }

  async uploadChatFile(file: File, messageType: 'IMAGE' | 'FILE' | 'VOICE') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('messageType', messageType);

    const token = localStorage.getItem('accessToken');
    // Use the configured client instance (baseURL includes /api) so uploads go to /api/chat/upload
    const response = await this.client.post('/chat/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    return response.data;
  }

  // Notification Methods
  async getNotifications(limit: number = 50) {
    return this.request<any>('GET', `/notifications?limit=${limit}`);
  }

  async getUnreadNotificationCount() {
    return this.request<any>('GET', '/notifications/unread/count');
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request<any>('PATCH', `/notifications/${notificationId}/read`);
  }

  async markAllNotificationsAsRead() {
    return this.request<any>('POST', '/notifications/mark-all-read');
  }

  async deleteNotification(notificationId: string) {
    return this.request<any>('DELETE', `/notifications/${notificationId}`);
  }

  async getNotificationPreferences() {
    return this.request<any>('GET', '/notifications/preferences');
  }

  async updateNotificationPreferences(preferences: any) {
    return this.request<any>('PATCH', '/notifications/preferences', preferences);
  }

  // Analytics
  async getPatientSpending(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>('GET', `/analytics/patient/spending?${params.toString()}`);
  }

  async getPatientRequestsToday() {
    return this.request<any>('GET', '/analytics/patient/requests-today');
  }

  async getPatientSatisfaction() {
    return this.request<any>('GET', '/analytics/patient/satisfaction');
  }

  async getPatientServiceBreakdown() {
    return this.request<any>('GET', '/analytics/patient/service-breakdown');
  }

  async getPatientSpendingAnalytics(months = 6) {
    return this.request<any>('GET', `/analytics/patient/spending-analytics?months=${months}`);
  }

  async getFavoriteHelpers(limit = 5) {
    return this.request<any>('GET', `/analytics/patient/favorite-helpers?limit=${limit}`);
  }

  async getServiceFrequency() {
    return this.request<any>('GET', '/analytics/patient/service-frequency');
  }
}

export const apiClient = new ApiClient();

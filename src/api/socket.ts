import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.DEV
  ? '/socket.io'
  : (import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'https://helpbuddyback.onrender.com');

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  /**
   * Connect using provided token or token from localStorage. If no token is
   * available, attempt a non-blocking silent refresh and initialize the socket
   * only if the refresh returns a token.
   */
  connect(token?: string): Socket | null {
    const t = token || localStorage.getItem('accessToken');

    if (!t) {
      // Non-blocking silent refresh: if it yields a token, initialize socket.
      if (import.meta.env.DEV) console.debug('[PAT-SOCKET][DEV] no accessToken, attempting silent refresh');
      fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        .then((r) => r.json().catch(() => null))
        .then((j: any) => {
          const newToken = j?.data?.accessToken;
          if (newToken) {
            localStorage.setItem('accessToken', newToken);
            try {
              this.initSocketWithToken(newToken);
            } catch {
              // ignore
            }
          }
        })
        .catch(() => {
          /* ignore */
        });
      return null;
    }

    // Reuse existing socket if present
    if (this.socket) {
      const socketAny = this.socket as any;
      const cur = socketAny.auth?.token;
      if (cur !== t) {
        socketAny.auth = { token: t };
        if (!this.socket.connected) this.socket.connect();
      }
      if (this.socket.connected) return this.socket;
    }

    return this.initSocketWithToken(t);
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    if (!this.socket) {
      const token = localStorage.getItem('accessToken');
      if (token) this.connect(token);
    }
    return this.socket;
  }

  private initSocketWithToken(token: string): Socket {
    const url = WS_URL.endsWith('/realtime') ? WS_URL : `${WS_URL}/realtime`;
    this.socket = io(url, { auth: { token }, reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000 });

    this.socket.on('connect', () => {
      if (import.meta.env.DEV) console.debug('[PAT-SOCKET] connected', this.socket?.id);
      try {
        const serviceId = localStorage.getItem('activeServiceId');
        if (serviceId) {
          this.socket?.emit('join:service', { serviceId }, (ack?: unknown) => {
            if (import.meta.env.DEV) console.debug('[JOIN DEBUG]', { serviceId, ack });
          });
        }
      } catch {
        /* ignore */
      }
    });

    this.socket.on('disconnect', async (reason) => {
      if (import.meta.env.DEV) console.debug('[PAT-SOCKET] disconnected', reason);
      // If server explicitly disconnected (often for auth), try refresh and reconnect
      if (reason === 'io server disconnect' || reason === 'transport close') {
        try {
          const resp = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
          const j = await resp.json().catch(() => null);
          const newToken = j?.data?.accessToken || null;
          if (newToken) {
            localStorage.setItem('accessToken', newToken);
            // Reconnect with new token — connect will update existing socket if present
            this.connect(newToken);
          }
        } catch {
          // ignore
        }
      }
    });

    this.socket.on('connect_error', (err) => {
      if (import.meta.env.DEV) console.debug('[PAT-SOCKET] connect_error', err);
    });

    // Listen for invalid token signature from server
    this.socket.on('auth:invalid', (data: { reason?: string; message?: string }) => {
      console.warn('[PAT-SOCKET] Server rejected token:', data.message || data.reason);
      // Clear invalid tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // Disconnect socket
      this.disconnect();
      // Redirect to login page if not already there
      try {
        if (window.location.pathname !== '/auth') {
          window.location.href = '/auth';
        }
      } catch {
        // ignore
      }
    });

    return this.socket;
  }

  emit(event: string, ...args: unknown[]) {
    if (this.socket?.connected) {
      (this.socket as unknown as { emit: (...a: unknown[]) => void }).emit(event, ...args);
    }
  }

  on(event: string, cb: (...args: unknown[]) => void) {
    if (!this.socket) {
      const token = localStorage.getItem('accessToken');
      if (token) this.connect(token);
    }
    const set = this.listeners.get(event) || new Set<(...args: unknown[]) => void>();
    if (set.has(cb)) return;
    set.add(cb);
    this.listeners.set(event, set);
    this.socket?.on(event, cb);
  }

  off(event: string, cb?: (...args: unknown[]) => void) {
    if (!this.socket) return;
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    if (cb) {
      if (set.has(cb)) {
        set.delete(cb);
        this.socket.off(event, cb);
      }
      if (set.size === 0) this.listeners.delete(event);
      return;
    }
    for (const c of Array.from(set)) {
      try {
        this.socket.off(event, c);
      } catch {
        // ignore
      }
    }
    this.listeners.delete(event);
  }
}

export const socketClient = new SocketClient();

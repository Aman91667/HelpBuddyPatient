import { io, Socket } from 'socket.io-client';

class ChatSocketClient {
  private socket: Socket | null = null;
  private serviceId: string | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    const apiUrl = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : window.location.origin;
    const ns = `${apiUrl}/chat`;
    this.socket = io(ns, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    // Attach any previously-registered listeners now that socket exists
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.socket?.on(event, cb);
      });
    });

    this.socket.on('connect', () => {
      console.log('[ChatSocket] Connected to chat server');
    });

    this.socket.on('disconnect', () => {
      console.log('[ChatSocket] Disconnected from chat server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[ChatSocket] Connection error:', error);
    });

    this.socket.on('auth:invalid', () => {
      console.log('[ChatSocket] Invalid auth, clearing tokens');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/auth';
    });

    // Persist rotated access tokens sent by the server during handshake or rotation
    this.socket.on('auth:rotated', (payload: any) => {
      try {
        if (payload && payload.accessToken) {
          localStorage.setItem('accessToken', payload.accessToken);
        }
      } catch (e) { /* ignore */ }
    });

    return this.socket;
  }

  joinService(serviceId: string) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }

    this.serviceId = serviceId;
    this.socket.emit('join:service', { serviceId });
    console.log(`[ChatSocket] Joined service: ${serviceId}`);
  }

  leaveService() {
    if (!this.socket || !this.serviceId) return;

    this.socket.emit('leave:service', { serviceId: this.serviceId });
    console.log(`[ChatSocket] Left service: ${this.serviceId}`);
    this.serviceId = null;
  }

  async sendMessage(data: {
    serviceId: string;
    messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'TEMPLATE';
    messageText?: string;
    fileUrl?: string;
    filename?: string;
    fileSize?: number;
    mimeType?: string;
    // optional client-supplied fields
    senderId?: string;
    senderType?: 'PATIENT' | 'HELPER';
  }) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return { success: false, error: 'socket-not-connected' };
    }

    // Ensure sender info is present for server-side createMessage validation
    const payload = {
      ...data,
      senderId: data.senderId || localStorage.getItem('userId') || undefined,
      senderType: data.senderType || 'PATIENT',
      // Use nullish coalescing to correctly pick empty strings too
      message: data.messageText ?? (data as any).message ?? undefined,
      // Normalize file name casing so server will receive `fileName` (Prisma expects camelCase)
      fileName: (data as any).fileName ?? (data as any).filename ?? undefined,
    } as any;

    return new Promise((resolve) => {
      try {
        this.socket!.emit('send:message', payload, (res: any) => {
          resolve(res);
        });
      } catch (e) {
        resolve({ success: false, error: (e as any)?.message || 'emit failed' });
      }
    });
  }

  private _registerListener(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event)!;
    if (set.has(callback)) return;
    set.add(callback);
    if (this.socket) this.socket.on(event, callback);
  }

  onNewMessage(callback: (message: any) => void) {
    // Listen for service-room broadcasts (payload is the message object)
    this._registerListener('message:received', (msg: any) => {
      callback(msg);
    });

    // Listen for direct-to-user notifications (payload may be { serviceId, message })
    this._registerListener('message:new', (payload: any) => {
      if (payload && payload.message) {
        callback(payload.message);
      } else {
        callback(payload);
      }
    });
  }

  onMessageRead(callback: (data: any) => void) {
    this._registerListener('message:read', callback);
  }

  onMessagesRead(callback: (data: any) => void) {
    this._registerListener('messages:read', callback);
  }

  emitMarkAsRead(serviceId: string, userId: string) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }
    this.socket.emit('messages:mark-read', { serviceId, userId });
  }

  onTypingStart(callback: (data: { senderId: string }) => void) {
    this._registerListener('user:typing', (data: { userId: string }) => {
      callback({ senderId: data.userId });
    });
  }

  onTypingStop(callback: (data: { senderId: string }) => void) {
    this._registerListener('user:stopped-typing', (data: { userId: string }) => {
      callback({ senderId: data.userId });
    });
  }

  emitTypingStart(serviceId: string) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }
    const userId = localStorage.getItem('userId') || '';
    const userType = 'PATIENT';
    this.socket.emit('typing:start', { serviceId, userId, userType });
  }

  emitTypingStop(serviceId: string) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }
    const userId = localStorage.getItem('userId') || '';
    this.socket.emit('typing:stop', { serviceId, userId });
  }

  disconnect() {
    if (this.socket) {
      this.leaveService();
      try { this.socket.disconnect(); } catch (e) { /* ignore */ }
      this.socket = null;
    }
    this.listeners.clear();
  }

  getSocket() {
    return this.socket;
  }
}

export const chatSocket = new ChatSocketClient();

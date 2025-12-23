import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User, OTPRequest, OTPVerify, AuthResponse } from '@/types';
import { apiClient } from '@/api/client';
import { socketClient } from '@/api/socket';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { API_ENDPOINTS } from '@/core/config/constants';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requestOTP: (data: OTPRequest) => Promise<{ success: boolean; code?: string }>;
  verifyOTP: (data: OTPVerify) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // debounce auth check slightly to avoid HMR reload loops triggering
  // repeated concurrent refresh attempts. A small 300ms delay is enough to
  // collapse multiple rapid reloads during development.
  const authTimerRef = useRef<number | null>(null);
  // Provider-local dedupe for silent refresh calls to avoid concurrent POSTs
  const refreshPromiseRef = useRef<Promise<{ success?: boolean; data?: { accessToken?: string } } | null> | null>(null);
  useEffect(() => {
    authTimerRef.current = window.setTimeout(() => {
      checkAuth();
    }, 300);
    return () => {
      if (authTimerRef.current) {
        window.clearTimeout(authTimerRef.current);
        authTimerRef.current = null;
      }
    };
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      // Try silent refresh only if we have a fallback refresh token stored in
      // localStorage (dev) — otherwise skip and proceed unauthenticated. This
      // avoids spamming the backend with 400 responses when the user hasn't
      // logged in yet.
      const storedRefresh = localStorage.getItem('refreshToken');
      if (!storedRefresh) {
        setIsLoading(false);
        return;
      }

      // try silent refresh using httpOnly refresh cookie or stored fallback
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'https://helpbuddyback.onrender.com/api';
        // Deduplicate concurrent refresh attempts within this provider
        if (!refreshPromiseRef.current) {
          const fetchOptions: RequestInit = { method: 'POST', credentials: 'include' };
          fetchOptions.headers = { 'Content-Type': 'application/json' };
          fetchOptions.body = JSON.stringify({ refreshToken: storedRefresh });
          refreshPromiseRef.current = (async () => {
            const resp = await fetch(`${API_URL}/auth/refresh`, fetchOptions);
            let j: unknown = null;
            try { j = await resp.json(); } catch {
              if (import.meta.env.DEV) console.debug('[AUTH] refresh non-json response', resp.status, resp.statusText);
            }
            if (import.meta.env.DEV) console.debug('[AUTH] refresh response', resp.status, j);
            
            // If refresh failed with 401, tokens are invalid - clear them
            if (resp.status === 401) {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              return null;
            }
            
            return j as { success?: boolean; data?: { accessToken?: string } } | null;
          })();
        }

        const parsed = await refreshPromiseRef.current;
        // clear the ref so future refreshes can be attempted later
        refreshPromiseRef.current = null;

        if (parsed?.success && parsed.data?.accessToken) {
          const newToken = parsed.data.accessToken as string;
          localStorage.setItem('accessToken', newToken);
          const userResp = await apiClient.get<User>('/auth/me');
          if (userResp.success && userResp.data) {
            setUser(userResp.data);
            socketClient.connect(newToken);
            // If there's an active service for this user, restore tracking state
            // Only navigate to tracking if service is ACCEPTED or STARTED (not REQUESTED)
            try {
              const active = await apiClient.get<any>(API_ENDPOINTS.SERVICES.ACTIVE);
              if (active.success && active.data && active.data.id) {
                const status = active.data.status;
                try { localStorage.setItem('activeServiceId', active.data.id); } catch {}
                if (status === 'ACCEPTED' || status === 'STARTED') {
                  navigate(`/tracking/${active.data.id}`);
                }
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore, proceed unauthenticated
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Verify token is for PATIENT
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.userType !== 'PATIENT') {
          console.error('[AUTH] Invalid user type in token:', payload.userType);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.error('[AUTH] Failed to decode token:', e);
      }
    }

    try {
      const response = await apiClient.get<User>('/auth/me');
      if (response.success && response.data) {
        setUser(response.data);
        // Connect socket
        socketClient.connect(token);
        // After a normal auth/me, attempt to restore any active service and
        // navigate to tracking if present.
        // Only navigate to tracking if service is ACCEPTED or STARTED (not REQUESTED)
        try {
          const active = await apiClient.get<any>(API_ENDPOINTS.SERVICES.ACTIVE);
          if (active.success && active.data && active.data.id) {
            const status = active.data.status;
            try { localStorage.setItem('activeServiceId', active.data.id); } catch {}
            if (status === 'ACCEPTED' || status === 'STARTED') {
              navigate(`/tracking/${active.data.id}`);
            }
          }
        } catch {
          // ignore
        }
      } else {
        // If /auth/me failed, attempt a single silent refresh and retry once
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'https://helpbuddyback.onrender.com/api';
          if (!refreshPromiseRef.current) {
            refreshPromiseRef.current = (async () => {
              const resp = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
              let j: unknown = null;
              try { j = await resp.json(); } catch { /* ignore non-json */ }
              if (import.meta.env.DEV) console.debug('[AUTH] refresh response on retry', resp.status, j);
              return j as { success?: boolean; data?: { accessToken?: string } } | null;
            })();
          }

          const parsed = await refreshPromiseRef.current;
          refreshPromiseRef.current = null;

          if (parsed?.success && parsed.data?.accessToken) {
            const newToken = parsed.data.accessToken as string;
            localStorage.setItem('accessToken', newToken);
            const retry = await apiClient.get<User>('/auth/me');
            if (retry.success && retry.data) {
              setUser(retry.data);
              socketClient.connect(newToken);
              // restore active service if any
              try {
                const active = await apiClient.get<any>(API_ENDPOINTS.SERVICES.ACTIVE);
                if (active.success && active.data && active.data.id) {
                  try { localStorage.setItem('activeServiceId', active.data.id); } catch {}
                  navigate(`/tracking/${active.data.id}`);
                  return;
                }
              } catch {
                // ignore
              }
              return;
            }
          }
        } catch {
          // ignore and fall through to cleanup
        }

        localStorage.removeItem('accessToken');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestOTP = async (data: OTPRequest): Promise<{ success: boolean; code?: string }> => {
    try {
      // Backend expects { phone: string, role?: 'PATIENT' | 'HELPER' }
      const payload = data.type === 'PHONE' 
        ? { phone: data.value, role: 'PATIENT' as const }
        : { phone: data.value, role: 'PATIENT' as const }; // Email not supported yet, send as phone
      
      const response = await apiClient.post<{ success: boolean; code?: string }>('/auth/request-otp', payload);
      if (response.success) {
        toast.success('OTP sent successfully');
        return { success: true, code: (response as any).code };
      } else {
        toast.error(response.error || 'Failed to send OTP');
        return { success: false };
      }
    } catch (error: any) {
      // Log the full error for debugging
      console.error('[requestOTP] Error:', error);
      
      // Show validation errors if available
      const errorMessage = error?.response?.data?.message;
      if (Array.isArray(errorMessage)) {
        toast.error(errorMessage.join(', '));
      } else if (errorMessage) {
        toast.error(errorMessage);
      } else {
        toast.error('Failed to send OTP');
      }
      return { success: false };
    }
  };

  const verifyOTP = async (data: OTPVerify): Promise<boolean> => {
    try {
      // Backend expects { phone: string, otp: string, name?: string, role?: 'PATIENT' | 'HELPER' }
      const payload = {
        phone: data.value,
        otp: data.code,
        name: data.name,
        role: 'PATIENT' as const
      };
      
      const response = await apiClient.post<AuthResponse['data']>('/auth/verify-otp', payload);
      if (response.success && response.data) {
        const { accessToken, refreshToken, user: userData } = response.data as AuthResponse['data'];
        
        // Verify that the token is for a PATIENT user
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]));
          if (payload.userType !== 'PATIENT') {
            console.error('[AUTH] Invalid user type:', payload.userType);
            toast.error('This account is not registered as a patient');
            return false;
          }
        } catch (e) {
          console.error('[AUTH] Token validation failed:', e);
        }
        
        // store access token client-side. In development we also keep a copy of
        // the refreshToken in localStorage as a fallback because SameSite/secure
        // rules can prevent the cookie from being sent over HTTP during dev.
        localStorage.setItem('accessToken', accessToken);
        if (import.meta.env.DEV && refreshToken) {
          try {
            localStorage.setItem('refreshToken', refreshToken);
          } catch {
            // ignore storage errors
          }
        }
        setUser(userData);
        
        // Connect socket
        socketClient.connect(accessToken);
        // After login, check for an active service and resume tracking if found
        // Only navigate to tracking if service is ACCEPTED or STARTED (not REQUESTED)
        try {
          const active = await apiClient.get<any>(API_ENDPOINTS.SERVICES.ACTIVE);
          if (active.success && active.data && active.data.id) {
            const status = active.data.status;
            try { localStorage.setItem('activeServiceId', active.data.id); } catch {}
            if (status === 'ACCEPTED' || status === 'STARTED') {
              toast.success('Login successful — resuming active service');
              navigate(`/tracking/${active.data.id}`);
              return true;
            }
          }
        } catch {
          // ignore
        }

        toast.success('Login successful');
        navigate('/');
        return true;
      } else {
        toast.error(response.error || 'Invalid OTP');
        return false;
      }
    } catch {
      toast.error('Failed to verify OTP');
      return false;
    }
  };

  const logout = async (opts?: { global?: boolean }) => {
    const { global = false } = opts || {};
    try {
      // By default perform a local-only logout (do not revoke refresh token on server)
      // This keeps other devices / sessions logged in. To revoke server-side session pass { global: true }.
      if (global) {
        try {
          await apiClient.post('/auth/logout');
        } catch (err) {
          console.error('Logout (global) error:', err);
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local session state
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      try { localStorage.removeItem('activeServiceId'); } catch {}
      setUser(null);
      socketClient.disconnect();
      navigate('/auth');
      toast.success('Logged out successfully');
    }
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await apiClient.get<User>('/auth/me');
      if (response.success && response.data) {
        setUser(response.data);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        requestOTP,
        verifyOTP,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

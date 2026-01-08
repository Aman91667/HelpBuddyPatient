import { useState, useEffect, useCallback, useRef } from 'react';
import { socketClient } from '@/api/socket';

interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy?: number | null;
  timestamp?: number;
}

interface UseLocationOptions {
  enabled: boolean;
  serviceId?: string;
  updateInterval?: number;
}

/**
 * Hook for tracking patient location and sending real-time updates to helper
 * Mirrors the helper's useLocation hook functionality
 */
export const useLocation = ({ enabled, serviceId, updateInterval = 5000 }: UseLocationOptions) => {
  const [location, setLocation] = useState<LocationUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const watchIdRef = useRef<number | null>(null);
  const retryRef = useRef<number>(0);
  const lastEmitRef = useRef<number>(0);
  const permissionCheckedRef = useRef<boolean>(false);

  const updateLocation = useCallback(
    async (position: GeolocationPosition) => {
      const locationData: LocationUpdate = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };

      setLocation(locationData);

      if (serviceId && enabled) {
        const now = Date.now();
        
        // only emit if enough time has passed since last emit
        if (now - lastEmitRef.current >= updateInterval) {
          lastEmitRef.current = now;

          // Send via socket for real-time
          try {
            const socket = socketClient.getSocket();
            if (socket && socket.connected) {
              socket.emit('patient:location:update', {
                serviceId,
                lat: locationData.lat,
                lng: locationData.lng,
                accuracy: locationData.accuracy,
              });
            }
          } catch (e) {
            console.error('Failed to emit patient location via socket:', e);
          }
        }
      }
    },
    [serviceId, enabled, updateInterval]
  );

  const handleError = useCallback((error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      setPermissionStatus('denied');
      setError('Location permission denied. Please enable location access in your browser settings.');
      console.warn('Location permission denied');
      return;
    }

    const friendly = error?.message || 'Unknown geolocation error';
    const msg = friendly.includes('Timeout') || friendly.toLowerCase().includes('timeout')
      ? 'Location timeout — move to an area with better GPS signal or try again.'
      : friendly;
    setError(msg);
    console.warn('Location error:', error);

    const TIMEOUT_CODE = 3;

    try {
      if (error?.code === TIMEOUT_CODE && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            updateLocation(pos);
            retryRef.current = 0;
            setError(null);
          },
          (e) => {
            console.debug('Fallback geolocation failed:', e);
            retryRef.current = Math.min(5, retryRef.current + 1);
            const backoffMs = 3000 * Math.pow(2, retryRef.current - 1);
            setTimeout(() => {
              try {
                if (navigator.geolocation) {
                  if (watchIdRef.current) {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                    watchIdRef.current = null;
                  }
                  const t = Math.min(120000, 30000 * Math.pow(2, retryRef.current - 1));
                  const newId = navigator.geolocation.watchPosition(updateLocation, handleError, {
                    enableHighAccuracy: true,
                    timeout: t,
                    maximumAge: 0,
                  });
                  watchIdRef.current = newId;
                  setWatchId(newId);
                }
              } catch (ee) {
                console.error('Failed to restart geolocation watch:', ee);
              }
            }, backoffMs);
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
        );
      }
    } catch (e) {
      console.error('Geolocation error handling failed:', e);
    }
  }, [updateLocation]);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    if (permissionCheckedRef.current) return;
    permissionCheckedRef.current = true;

    // Attempt to get initial position and request permission
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermissionStatus('granted');
        updateLocation(pos);
        retryRef.current = 0;
        setError(null);

        // Start watching for future updates
        if (watchIdRef.current) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        const newWatchId = navigator.geolocation.watchPosition(updateLocation, handleError, {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0,
        });
        watchIdRef.current = newWatchId;
        setWatchId(newWatchId);
      },
      (err) => {
        handleError(err);
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, updateLocation, handleError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setWatchId(null);
    }
  }, []);

  return { location, error, watchId, permissionStatus, stopTracking };
};

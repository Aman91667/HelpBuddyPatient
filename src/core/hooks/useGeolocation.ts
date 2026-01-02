import { useState, useEffect, useRef } from 'react';
import type { Location } from '@/types';
import { toast } from 'sonner';

export const useGeolocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  // Use a ref to store the watch ID so we can clear it
  const watchIdRef = useRef<number | null>(null);

  const startWatching = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      toast.error('Geolocation is not supported');
      return;
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setIsLoading(true);
    setError(null);

    // First attempt a single getCurrentPosition to ensure the browser shows
    // the permission prompt in contexts where implicit watchPosition may be
    // suppressed (some mobile browsers require a user gesture or explicit get).
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setPermissionStatus('granted');
        setIsLoading(false);

        // After initial success, start watching for updates
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setPermissionStatus('granted');
            setIsLoading(false);
          },
          (watchErr) => {
            let errorMessage = 'Failed to get your location';
            if (watchErr.code === watchErr.PERMISSION_DENIED) {
              setPermissionStatus('denied');
              errorMessage = 'Location permission denied. Please enable it in your browser settings.';
            } else if (watchErr.code === watchErr.TIMEOUT) {
              errorMessage = 'Location request timed out. Retrying...';
            } else {
              errorMessage = watchErr.message;
              setIsLoading(false);
            }
            setError(errorMessage);
            if (watchErr.code === watchErr.PERMISSION_DENIED) {
              toast.error(errorMessage);
              setIsLoading(false);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 5000,
          }
        );
      },
      (err) => {
        // If getCurrentPosition fails, handle permission denial explicitly.
        let errorMessage = 'Failed to get your location';
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionStatus('denied');
          errorMessage = 'Location permission denied. Please enable it in your browser settings.';
          toast.error(errorMessage);
          setIsLoading(false);
        } else if (err.code === err.TIMEOUT) {
          // If initial request times out, still attempt to start watchPosition
          setError('Initial location request timed out. Attempting continuous tracking...');
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              setPermissionStatus('granted');
              setIsLoading(false);
            },
            (watchErr) => {
              setError(watchErr.message || 'Failed to watch location');
              setIsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
          );
        } else {
          errorMessage = err.message;
          setError(errorMessage);
          setIsLoading(false);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  // Check permission status without requesting it, just for UI state
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionStatus(result.state);
        result.addEventListener('change', () => {
          setPermissionStatus(result.state);
        });
      }).catch(() => {
        // Ignore errors if permissions API is not supported
      });
    }

    startWatching();

    // Cleanup on unmount
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    location,
    error,
    isLoading,
    permissionStatus,
    refetch: startWatching,
  };
};

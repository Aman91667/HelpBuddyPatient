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

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setPermissionStatus('granted');
        setIsLoading(false);
      },
      (err) => {
        let errorMessage = 'Failed to get your location';
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionStatus('denied');
          errorMessage = 'Location permission denied. Please enable it in your browser settings.';
        } else if (err.code === err.TIMEOUT) {
          errorMessage = 'Location request timed out. Retrying...';
          // Don't clear loading state on timeout in watch mode, it might succeed next time
        } else {
          errorMessage = err.message;
          setIsLoading(false);
        }

        setError(errorMessage);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(errorMessage);
          setIsLoading(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000, // Accept slightly cached positions for better performance
      }
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

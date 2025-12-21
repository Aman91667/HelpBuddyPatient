import { useState, useEffect } from 'react';
import type { Location } from '@/types';
import { toast } from 'sonner';

export const useGeolocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  const requestLocationPermission = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      toast.error('Geolocation is not supported');
      return false;
    }

    try {
      // Check if Permissions API is available
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionStatus(result.state);
        
        if (result.state === 'denied') {
          toast.error('Location permission denied. Please enable it in your browser settings.');
          setError('Location permission denied');
          return false;
        }
        
        if (result.state === 'prompt') {
          toast.info('Please allow location access to continue');
        }
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissionStatus(result.state);
        });
      }
      
      return true;
    } catch (err) {
      // Permissions API not fully supported, proceed with geolocation request
      console.warn('Permissions API not available:', err);
      return true;
    }
  };

  const getCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setPermissionStatus('granted');
        setIsLoading(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionStatus('denied');
          setError('Location permission denied');
          toast.error('Location permission denied. Please enable it in your browser settings.');
        } else if (err.code === err.TIMEOUT) {
          setError('Location request timed out');
          toast.error('Location request timed out. Please try again.');
        } else {
          setError(err.message);
          toast.error('Failed to get your location');
        }
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  return {
    location,
    error,
    isLoading,
    permissionStatus,
    refetch: getCurrentLocation,
  };
};

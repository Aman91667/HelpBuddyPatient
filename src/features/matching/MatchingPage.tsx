import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import type { Service } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import useSocket from '@/core/hooks/useSocket';
import { ROUTES } from '@/core/config/constants';

const MatchingPage = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { on, off } = useSocket();
  const [service, setService] = useState<Service | null>(null);
  const [dots, setDots] = useState('');
  const [userLocation, setUserLocation] = useState<string | null>(null);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + '.' : ''));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Get stored location
  useEffect(() => {
    const storedLocation = localStorage.getItem('userLocation');
    if (storedLocation) setUserLocation(storedLocation);
  }, []);

  useEffect(() => {
    if (!serviceId) return;

    // Fetch service details
    fetchServiceDetails();

    // Setup socket listeners
    const handleAccepted = (data: any) => {
      toast.success('Helper Found!', {
        description: `Your helper ${data?.helper?.name || 'someone nearby'} accepted your request.`,
      });

      if (data?.serviceId || serviceId) {
        localStorage.setItem('activeServiceId', data?.serviceId || serviceId);
        navigate(`/tracking/${data?.serviceId || serviceId}`);
      }
    };

    on('service:accepted', handleAccepted);

    return () => {
      off('service:accepted', handleAccepted);
    };
  }, [serviceId, on, off, navigate]);

  const fetchServiceDetails = async () => {
    if (!serviceId) return;
    
    const response = await apiClient.get<Service>(`/services/${serviceId}`);
    if (response.success && response.data) {
      setService(response.data);
      
      // If already accepted, navigate to tracking
      if (response.data.status === 'ACCEPTED') {
        navigate(`/tracking/${serviceId}`);
      }
    }
  };


  const handleCancel = async () => {
    if (!serviceId) return;

    try {
      const response = await apiClient.post(`/services/${serviceId}/cancel`);
      if (response.success) {
        toast.success('Request cancelled');
        navigate(ROUTES.HOME);
      } else {
        toast.error(response.error || 'Failed to cancel');
      }
    } catch (error) {
      toast.error('Failed to cancel request');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="container mx-auto max-w-md">
        <div className="card-glass p-8 rounded-3xl text-center space-y-6 relative">
          {/* Close Button */}
          <button
            onClick={() => navigate(ROUTES.HOME)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Animated Loader */}
          <div className="relative">
            <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-accent to-primary p-1 animate-pulse">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
              </div>
            </div>
          </div>

          {/* Title and description */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Finding a Helper{dots}</h2>
            <p className="text-muted-foreground">
              We're matching you with the best available helper nearby.
            </p>
          </div>

          {/* Service Info */}
          {service && (
            <div className="bg-background/50 rounded-xl p-4 text-left space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Service Types</p>
                <p className="font-medium">
                  {Array.isArray(service.serviceType) 
                    ? service.serviceType.join(', ') 
                    : service.serviceType}
                </p>
              </div>
              {service.estimatedHelpers !== undefined && (
                <div>
                  <p className="text-sm text-muted-foreground">Nearby Helpers</p>
                  <p className="font-medium">{service.estimatedHelpers}</p>
                </div>
              )}
            </div>
          )}

          {/* Optional Location */}
          {userLocation && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-accent" />
              <span className="text-muted-foreground">{userLocation}</span>
            </div>
          )}

          {/* Small hint text */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Usually takes less than 30 seconds</span>
          </div>

          {/* Cancel Button */}
          <Button
            variant="destructive"
            onClick={handleCancel}
            className="w-full"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel Request
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MatchingPage;

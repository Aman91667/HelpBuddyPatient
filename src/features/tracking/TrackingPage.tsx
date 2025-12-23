import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { socketClient } from '@/api/socket';
import { apiClient } from '@/api/client';
import type { Service, Location, ServicePayload } from '@/types';
import { Map } from '@/components/Map';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { RatingModal } from '@/components/RatingModal';
import { ChatWindow } from '@/features/chat/ChatWindow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Phone,
  MapPin,
  Navigation,
  Clock,
  CheckCircle2,
  MessageCircle,
  Target,
  Loader2,
  X,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/core/config/constants';

export default function TrackingPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [helperLocation, setHelperLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  // const [hasRated, setHasRated] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const fetchServiceDetails = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const response = await apiClient.get<Service>(`/services/${serviceId}`);
      if (response.success && response.data) {
        const raw = response.data as Service;
        const svc = { ...raw } as Service;
        const st1 = (svc as any).serviceType;
        if (typeof st1 === 'string') {
          (svc as any).serviceType = st1.split(',').map((s: string) => String(s).trim()).filter(Boolean);
        }
        setService(svc);
        if (response.data.helper?.currentLocation) setHelperLocation(response.data.helper.currentLocation);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId) return;
    fetchServiceDetails();

    const onLocation = (...args: any[]) => {
      const d = args[0] as any;
      if (!d) return;
      if (String(d.serviceId) === String(serviceId)) setHelperLocation({ lat: d.lat, lng: d.lng });
    };

    const onArrived = () => { toast.success('Helper has arrived!'); fetchServiceDetails(); };
    const onStarted = () => { toast.success('Service started'); fetchServiceDetails(); };
    const onCompleted = () => {
      toast.success('Service completed');
      fetchServiceDetails();
      // Navigate to payment page first, rating will come after payment
      navigate(`/payment/${serviceId}`);
    };
    const onAccepted = (...args: any[]) => {
      const data = args[0] as ServicePayload | undefined;
      if (!data) return;
      const sid = data.serviceId || data.service?.id || (data.service && (data.service as any).id);
      if (String(sid) !== String(serviceId)) return;
      if (data.service) {
        const svc = { ...(data.service as Service) } as Service;
        const svcAny = svc as any;
        if (typeof svcAny.serviceType === 'string') {
          svcAny.serviceType = (svcAny.serviceType as string).split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        setService(svcAny as Service);
        const loc = data.helper?.currentLocation || svcAny.helper?.currentLocation;
        if (loc && typeof loc.lat === 'number') setHelperLocation(loc as Location);
        return;
      }
      if (data.helper) {
        setService(prev => ({ ...(prev as Service || {}), helper: data.helper, status: 'ACCEPTED' } as Service));
        const loc = data.helper.currentLocation as Location | undefined;
        if (loc && typeof loc.lat === 'number') setHelperLocation(loc);
      }
    };

    socketClient.on('helper:location', onLocation);
    socketClient.on('helper:arrived', onArrived);
    socketClient.on('service:started', onStarted);
    socketClient.on('service:completed', onCompleted);
    socketClient.on('service:accepted', onAccepted);

    return () => {
      socketClient.off('helper:location', onLocation);
      socketClient.off('helper:arrived', onArrived);
      socketClient.off('service:started', onStarted);
      socketClient.off('service:completed', onCompleted);
      socketClient.off('service:accepted', onAccepted);
    };
  }, [serviceId, fetchServiceDetails, navigate]);

  if (loading || !service) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-white to-slate-50">
        <div className="w-full max-w-md">
          <div className="rounded-2xl p-6 shadow-2xl bg-white/80 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="rounded-lg p-4 bg-emerald-50">
                <Loader2 className="animate-spin h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Loading service</h3>
                <p className="text-sm text-slate-500">Fetching latest location and info…</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const helperName = (() => {
    const h = service.helper as any;
    const alt = (service.helper as unknown as { user?: { name?: string } })?.user?.name;
    return h?.name || alt || 'Helper';
  })();

  const markers: Array<{ position: Location; popup?: string; type: 'patient' | 'helper' }> = [
    { position: service.patientLocation, popup: 'You', type: 'patient' },
  ];
  if (helperLocation) markers.push({ position: helperLocation, popup: helperName, type: 'helper' });

  const distanceBetween = (a?: Location | null, b?: Location | null) => {
    if (!a || !b) return null;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
    return R * c;
  };

  const meters = distanceBetween(service.patientLocation, helperLocation || service.helper?.currentLocation);
  const formatDistance = (meters: number | null) => {
    if (meters == null) return '—';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const statusLabel = () => {
    switch (service?.status) {
      case 'ACCEPTED': return { text: 'On the way', color: 'from-emerald-400 to-green-400', icon: <Navigation className="h-4 w-4" /> };
      case 'HELPER_ARRIVED': return { text: 'Arrived', color: 'from-sky-400 to-blue-500', icon: <MapPin className="h-4 w-4" /> };
      case 'IN_PROGRESS': return { text: 'In progress', color: 'from-indigo-400 to-violet-500', icon: <CheckCircle2 className="h-4 w-4" /> };
      default: return { text: 'Tracking', color: 'from-gray-300 to-gray-400', icon: <Clock className="h-4 w-4" /> };
    }
  };

  const handleCancelService = async () => {
    if (!serviceId) return;
    
    setIsCanceling(true);
    const doCancel = async () => {
      try {
        const resp = await apiClient.post(`/services/${serviceId}/cancel`);
        if (resp.success) {
          try { socketClient.emit('leave:service', { serviceId }); } catch {}
          try { localStorage.removeItem('activeServiceId'); } catch {}
          toast.success('Request cancelled successfully');
          navigate(ROUTES.HOME);
          return true;
        }
        return false;
      } catch (e) { 
        return false; 
      }
    };

    const ok = await doCancel();
    if (ok) {
      setIsCanceling(false);
      setShowCancelDialog(false);
      return;
    }

    // Try refreshing token and retry
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://helpbuddyback.onrender.com/api';
      const resp = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
      const j = await resp.json().catch(() => null);
      const parsed = j as { success?: boolean; data?: { accessToken?: string } } | null;
      if (parsed?.success && parsed.data?.accessToken) {
        const newToken = parsed.data.accessToken as string;
        try { localStorage.setItem('accessToken', newToken); } catch {}
        const retryOk = await doCancel();
        if (retryOk) {
          setIsCanceling(false);
          setShowCancelDialog(false);
          return;
        }
      }
    } catch {}

    setIsCanceling(false);
    toast.error('Failed to cancel request. Please try again.');
  };

  const handleSubmitRating = async (rating: number, comment: string) => {
    if (!serviceId) return;
    try {
      const response = await apiClient.rateService(serviceId, rating, comment);
      if (response.success) {
        toast.success('Rating submitted successfully!');
        // setHasRated(true);
        setShowRatingModal(false);
        navigate(`/payment/${serviceId}`);
      } else {
        toast.error(response.error || 'Failed to submit rating');
      }
    } catch (error) {
      toast.error('Failed to submit rating');
    }
  };

  const handleSkipRating = () => {
    setShowRatingModal(false);
    navigate(`/payment/${serviceId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Premium header */}
      <header className="w-full sticky top-0 z-40 bg-white/60 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
              <X className="h-5 w-5 text-slate-700" />
            </Button>

            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 shadow-sm">
                {service.helper?.profileImage ? (
                  <AvatarImage src={service.helper.profileImage} alt={helperName} />
                ) : (
                  <AvatarFallback className="bg-emerald-50 text-emerald-600 text-lg">{String(helperName).charAt(0)}</AvatarFallback>
                )}
              </Avatar>

              <div className="leading-tight">
                <div className="text-sm font-semibold">{helperName}</div>
                <div className="text-xs text-slate-500">{Array.isArray(service.serviceType) ? service.serviceType.join(', ') : String(service.serviceType || '')}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500">ETA</div>
              <div className="text-sm font-medium">{service.estimatedArrivalTime || '—'}</div>
              <div className="text-xs text-slate-500">{formatDistance(meters)}</div>
            </div>
            <div>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${statusLabel().color}`}>
                {statusLabel().icon}
                <span>{statusLabel().text}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 pb-28 sm:pb-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left card */}
        <section className="lg:col-span-1">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="rounded-2xl p-4 shadow-2xl bg-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{helperName}</h3>
                  {service.helper?.avgRating && service.helper.avgRating > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-50 rounded-full">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-semibold text-yellow-700">{service.helper.avgRating.toFixed(1)}</span>
                      <span className="text-xs text-yellow-600">({service.helper.totalRatings})</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Service ID <span className="font-mono ml-2 text-xs">{String(serviceId).slice(0, 8)}</span></p>
              </div>
            </div>

            <div className="mt-4 border rounded-lg p-4 bg-gradient-to-b from-white to-gray-50">
              <p className="text-sm text-slate-600">{service.description || 'No special notes'}</p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button onClick={() => { /* call flow */ }} className="flex-1 py-2 rounded-lg flex items-center justify-center gap-2">
                  <Phone className="h-4 w-4" />
                  Call
                </Button>
                {/* Show Chat button only after helper accepts the request */}
                {(service.status === 'ACCEPTED' || service.status === 'HELPER_ARRIVED' || service.status === 'IN_PROGRESS') && (
                  <Button variant="outline" onClick={() => setShowChat(true)} className="flex-1 py-2 rounded-lg flex items-center justify-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Chat
                  </Button>
                )}
              </div>

              {/* OTP Display - Show as soon as service is created */}
              {service.otpCode && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg">
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Verification Code
                  </div>
                  <div className="flex items-center justify-between bg-white/20 rounded-lg p-3 backdrop-blur">
                    <div className="font-mono text-3xl font-bold tracking-widest">
                      {service.otpCode}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={() => {
                        navigator.clipboard.writeText(service.otpCode!);
                        toast.success('OTP copied!');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-white/90 mt-2">
                    Share this code with your helper when they arrive
                  </p>
                </div>
              )}

              <div className="mt-4">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowCancelDialog(true)}
                >
                  Cancel Request
                </Button>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Map area - Hide when chat is open */}
        {!showChat && service.status !== 'COMPLETED' && service.status !== 'CANCELLED' && (
          <section className="lg:col-span-2">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="rounded-2xl overflow-hidden shadow-lg bg-white">
              <div className={`relative ${showCancelDialog ? 'pointer-events-none blur-sm opacity-50' : ''}`} style={{ height: 'calc(100vh - var(--app-header-height,64px) - var(--app-bottom-height,88px))' }}>
                <Map
                  center={helperLocation || service.patientLocation}
                  markers={markers}
                  height="calc-vh"
                  fitToMarkers
                  className="bg-white/80 dark:bg-slate-900/60 map-fixed"
                />

              {/* Floating info card on map */}
              <div className="absolute left-4 bottom-16 sm:bottom-12 w-[calc(100%-32px)] sm:w-96">
                <div className="p-3 rounded-xl bg-white/90 backdrop-blur border border-gray-100 shadow">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full p-2 bg-emerald-50">
                        <Target className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{helperName}</div>
                        <div className="text-xs text-slate-500">{formatDistance(meters)} away • {service.estimatedArrivalTime || '—'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        className="rounded-full bg-white shadow-sm p-2"
                        onClick={() => { /* focus to helper */ }}
                        aria-label="focus helper"
                      >
                        <Navigation className="h-4 w-4 text-slate-700" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top-right quick actions */}
              <div className="absolute right-4 top-4 flex flex-col gap-2">
                <Button size="icon" className="rounded-full bg-white/90 shadow-sm p-2" onClick={() => {/* center to patient */}} aria-label="center to patient">
                  <MapPin className="h-4 w-4 text-slate-700" />
                </Button>
                <Button size="icon" className="rounded-full bg-white/90 shadow-sm p-2" onClick={() => {/* open directions */}} aria-label="directions">
                  <Navigation className="h-4 w-4 text-slate-700" />
                </Button>
              </div>
            </div>
          </motion.div>
        </section>
        )}
        {/* Chat Window - Takes up the map area when open */}
        {showChat && service && service.status !== 'COMPLETED' && service.status !== 'CANCELLED' && (
          <section className="lg:col-span-2">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ duration: 0.2 }}
              className="relative"
              style={{ height: 'calc(100vh - var(--app-header-height,64px) - var(--app-bottom-height,88px))' }}
            >
              <ChatWindow
                serviceId={service.id}
                helperName={service.helper?.name || 'Helper'}
                onClose={() => setShowChat(false)}
              />
            </motion.div>
          </section>
        )}
      </main>

      {/* Mobile bottom sheet (hidden while chat is open to avoid overlap) */}
      {!showChat && (
        <div className="fixed left-0 right-0 bottom-0 z-40 sm:hidden">
          <div className="max-w-5xl mx-auto px-4 pb-safe">
            <div className="bg-white/95 border-t border-gray-100 p-3 rounded-t-2xl shadow-xl backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{helperName}</div>
                  <div className="text-xs text-slate-500">{formatDistance(meters)} away • {service.estimatedArrivalTime || '—'}</div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => { /* call */ }} className="px-3 py-2 rounded-lg">Call</Button>
                  {/* Show Chat button only after helper accepts */}
                  {(service.status === 'ACCEPTED' || service.status === 'HELPER_ARRIVED' || service.status === 'IN_PROGRESS') && (
                    <Button variant="outline" onClick={() => setShowChat(true)} className="px-3 py-2 rounded-lg">Chat</Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={handleSkipRating}
        onSubmit={handleSubmitRating}
        personName={helperName}
        personType="helper"
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Service Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this service request? This action cannot be undone.
              {service?.status === 'ACCEPTED' && ' The helper is already on the way to your location.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Keep Request</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelService}
              disabled={isCanceling}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCanceling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Canceling...
                </>
              ) : (
                'Yes, Cancel Request'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

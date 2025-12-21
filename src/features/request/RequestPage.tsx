import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGeolocation } from '@/core/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/api/client';
import { MapPin, Search, ArrowLeft, Loader2, Clock, Activity, UserCheck, Package } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ROUTES } from '@/core/config/constants';
import LiveMap from '@/features/home/components/LiveMap';
import logo from '@/assets/logo.png';

const requestSchema = z.object({
  serviceType: z.string().min(1, 'Select a service type'),
  description: z.string().max(500, 'Description too long').optional(),
  landmark: z.string().max(150).optional(),
});

type RequestForm = z.infer<typeof requestSchema>;

const services = [
  { id: 'LOW', name: 'Low (Quick Assist)', short: 'Low', color: 'from-blue-400 to-cyan-400', icon: Activity, iconBg: 'bg-blue-50' },
  { id: 'MODERATE', name: 'Moderate (Companion)', short: 'Moderate', color: 'from-pink-400 to-orange-400', icon: UserCheck, iconBg: 'bg-pink-50' },
  { id: 'HIGH', name: 'High (Express)', short: 'High', color: 'from-teal-400 to-green-400', icon: Package, iconBg: 'bg-emerald-50' },
];

export default function RequestPage() {
  const navigate = useNavigate();
  const { location } = useGeolocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimatedTime] = useState(4);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: { serviceType: '', description: '', landmark: '' },
  });

  const watchedLandmark = watch('landmark');
  const watchedService = watch('serviceType');

  // Reverse geocode the current location to get street address
  useEffect(() => {
    if (location) {
      // Always try to get the address when location changes
      const getAddress = async () => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&addressdetails=1`
          );
          const data = await response.json();
          
          if (data.display_name) {
            // Set the complete address
            setValue('landmark', data.display_name);
          } else {
            // Fallback to coordinates if no address found
            setValue('landmark', `Lat ${location.lat.toFixed(4)}, Lng ${location.lng.toFixed(4)}`);
          }
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
          // Fallback to coordinates on error
          setValue('landmark', `Lat ${location.lat.toFixed(4)}, Lng ${location.lng.toFixed(4)}`);
        }
      };
      
      // Only auto-fill if landmark is empty or contains coordinates
      if (!watchedLandmark || watchedLandmark.includes('Lat ')) {
        getAddress();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const onSubmit = async (data: RequestForm) => {
    if (!location && !data.landmark) {
      toast.error('Location not available — drop a pin or type an address');
      return;
    }
    if (!data.serviceType) {
      toast.error('Please select a service type');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post('/services', {
        patientLocation: {
          lat: location?.lat,
          lng: location?.lng,
          landmark: data.landmark,
        },
        serviceType: [data.serviceType],
        description: data.description,
      });

      if (response.success && response.data) {
        const serviceData = response.data as any;
        toast.success('Request submitted — searching for helpers');
        navigate(`/matching/${serviceData.id}`);
      } else {
        toast.error(response.error || 'Failed to submit request');
      }
    } catch (err) {
      toast.error('Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-start gap-8 lg:gap-12">

          {/* LEFT: FORM */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full lg:w-1/3"
          >
            <div className="rounded-3xl p-6 md:p-8 bg-white/90 backdrop-blur-sm shadow-xl border border-gray-100">

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => navigate(ROUTES.HOME)} className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm">
                    <img src={logo} alt="logo" className="w-full h-full object-contain" />
                  </div>
                </div>
                <div className="text-xs text-slate-500">Select hospital & service</div>
              </div>

              <h1 className="text-2xl font-extrabold tracking-tight mb-1">Find a <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Healper</span></h1>
              <p className="text-sm text-slate-600 mb-6">Verified helpers near hospitals — quick, safe and reliable.</p>

              <label className="text-sm font-semibold mb-2 block">1. Hospital / Location</label>
              <div className="relative mb-3">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary pointer-events-none" />
                <Input
                  placeholder="e.g., City Care Hospital, Jaipur"
                  {...register('landmark')}
                  className="pl-10 h-11 w-full bg-background/70"
                />
              </div>
              {location && !watchedLandmark && (
                <p className="text-xs text-slate-500 mb-3">📍 Detecting your location...</p>
              )}

              <label className="text-sm font-semibold mb-2 block">2. I need help with</label>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {services.map(svc => {
                  const active = watchedService === svc.id;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => setValue('serviceType', svc.id)}
                      className={`group p-3 rounded-xl transition-shadow transform hover:-translate-y-0.5 ${active ? 'ring-2 ring-emerald-400 bg-white' : 'bg-slate-50 hover:shadow'} flex flex-col items-center`}
                    >
                      <div className={`w-12 h-12 mb-2 rounded-lg flex items-center justify-center ${svc.iconBg} bg-gradient-to-br ${svc.color}`} />
                      <div className="text-xs font-semibold text-center">{svc.name}</div>
                    </button>
                  );
                })}
              </div>
              {errors.serviceType && <p className="text-sm text-destructive mb-3">{errors.serviceType.message}</p>}

              {watchedService && (
                <div className="mb-5 p-3 rounded-xl flex items-center justify-between border border-dashed border-emerald-200 bg-emerald-50">
                  <div className="flex items-center gap-2 text-sm text-slate-700"><Clock className="w-4 h-4" /> Estimated arrival</div>
                  <div className="text-lg font-semibold text-slate-900">{estimatedTime} min</div>
                </div>
              )}

              <div className="mt-2">
                <Button
                  type="submit"
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  className="w-full h-12 font-semibold text-base shadow-lg flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" /> Find HelpBudy
                    </>
                  )}
                </Button>
              </div>

              <p className="mt-4 text-xs text-slate-500">By submitting, you agree to our terms and confirm you are at the listed location.</p>
            </div>

            {/* small help card */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-4 text-sm text-slate-600">
              <div className="rounded-xl p-3 bg-white/60 border border-gray-100 shadow-sm">
                <div className="font-medium">Tips</div>
                <ul className="mt-1 list-disc list-inside text-xs">
                  <li>Tap the map to drop a pin — the address will fill automatically.</li>
                  <li>Provide a landmark for faster pickup inside busy hospitals.</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT: MAP */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="flex-1">
            <div className="h-[72vh] rounded-3xl overflow-hidden shadow-2xl border border-gray-100 relative">
              <LiveMap onAddress={(addr) => setValue('landmark', addr)} />

              <div className="absolute left-6 bottom-6 w-[calc(100%-96px)] sm:w-96">
                <div className="p-3 rounded-xl bg-white/95 backdrop-blur border border-gray-100 shadow flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Selected location</div>
                      <div className="text-xs text-slate-500 truncate">{watchedLandmark || (location ? `Lat ${location.lat.toFixed(4)}, Lng ${location.lng.toFixed(4)}` : 'Tap on map')}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-sm text-slate-700 mr-2">{estimatedTime} min</div>
                    <Button size="icon" className="rounded-full bg-white p-2 shadow-sm" onClick={() => window?.navigator?.geolocation?.getCurrentPosition?.(() => {})} aria-label="center">
                      <Clock className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

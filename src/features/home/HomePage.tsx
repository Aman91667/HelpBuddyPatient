import { motion } from 'framer-motion';
import { useAuth } from '@/features/auth/AuthContext';
import { useGeolocation } from '@/core/hooks/useGeolocation';
import { Map } from '@/components/Map';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  Plus,
  History,
  User,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/core/config/constants';
import logo from '@/assets/logo.png';
import { apiClient } from '@/api/client';
import { useEffect, useState } from 'react';

// Premium / modern HomePage (mobile-first responsive tweaks)
export default function HomePage() {
  const { user, logout } = useAuth();
  const { location, isLoading: locationLoading, refetch } = useGeolocation();
  const navigate = useNavigate();

  const [nearbyHelpers, setNearbyHelpers] = useState<number | null>(null);
  const [requestsToday, setRequestsToday] = useState<number | null>(null);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchSummary = async () => {
      try {
        const [breakdownResp, favResp] = await Promise.all([
          apiClient.getPatientServiceBreakdown(),
          apiClient.getFavoriteHelpers(5),
        ]);

        if (!mounted) return;

        if (breakdownResp.success && breakdownResp.data) {
          const breakdown = breakdownResp.data as any;
          // Total active/ongoing requests today (approx): use breakdown's recent count if available
          const total = (breakdown.breakdown || []).reduce((s: number, it: any) => s + (it.count || 0), 0);
          setRequestsToday(total || 0);
        }

        if (favResp.success && favResp.data) {
          const favs = favResp.data as any[];
          setNearbyHelpers(favs.length || 0);
          // approximate satisfaction by averaging helper avgRating in favorites
          if (favs.length > 0) {
            const avg = favs.reduce((s: number, it: any) => s + (it.avgRating || 0), 0) / favs.length;
            setSatisfaction(Number(avg.toFixed(1)));
          }
        }
      } catch (e) {
        // ignore — keep UI stable
      }
    };

    fetchSummary();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-28 pb-safe">
      {/* Top bar */}
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45 }}
        className="max-w-5xl mx-auto px-4 pt-4 sm:pt-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">

            <img src={logo} alt="HelpBudy Logo" className="w-9 h-9 sm:w-11 sm:h-11 object-contain" />

            <div>
              <h1 className="text-lg sm:text-2xl font-extrabold leading-tight text-slate-900">HelpBudy</h1>
              <p className="text-xs sm:text-sm text-slate-600">Welcome back, <span className="font-medium">{user?.name}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="rounded-lg bg-white/20 backdrop-blur hover:bg-white/40 shadow-sm"
              aria-label="Sign out"
            >
              <LogOut className="w-5 h-5 text-slate-800" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main content container */}
      <div className="max-w-5xl mx-auto px-4 mt-4 sm:mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left column: Map + stats */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="lg:col-span-2 space-y-3 sm:space-y-4"
        >
          <div className="rounded-2xl overflow-hidden shadow-2xl bg-white">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-emerald-500" />
                <div>
                  <h3 className="text-sm sm:text-md font-semibold text-slate-900">Your Location</h3>
                  <p className="text-xs sm:text-sm text-slate-500">Precise location for better matches</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refetch}
                  disabled={locationLoading}
                  className="rounded-lg px-3 py-2"
                >
                  {locationLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Refresh'
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 sm:p-4 bg-gradient-to-b from-white to-slate-50">
              <div className="rounded-xl overflow-hidden border bg-white h-[220px] sm:h-[300px] md:h-[420px]">
                {location ? (
                  <Map
                    center={location}
                    markers={[{ position: location, popup: 'You are here', type: 'patient' }]}
                    height="100%"
                    className="map-fixed"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-slate-100">
                    <div className="text-center px-4">
                      {locationLoading ? (
                        <>
                          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-2 text-emerald-500" />
                          <p className="text-sm text-slate-600">Fetching location...</p>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-10 w-10 mx-auto mb-2 text-slate-400" />
                          <p className="text-sm text-slate-600 mb-3">Location access needed</p>
                          <Button onClick={refetch} variant="default" size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                            Enable Location
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {location && (
                <p className="mt-2 text-xs sm:text-sm text-slate-500 text-right">Lat: {location.lat.toFixed(6)} · Lng: {location.lng.toFixed(6)}</p>
              )}
            </div>
          </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl p-3 bg-white shadow-lg border">
              <p className="text-xs text-slate-500">Nearby Helpers</p>
              <h4 className="text-base sm:text-lg font-bold text-slate-900">{nearbyHelpers !== null ? `${nearbyHelpers} within 2 km` : '—'}</h4>
            </div>
            <div className="rounded-xl p-3 bg-white shadow-lg border">
              <p className="text-xs text-slate-500">Requests Today</p>
              <h4 className="text-base sm:text-lg font-bold text-slate-900">{requestsToday !== null ? `${requestsToday} active` : '—'}</h4>
            </div>
            <div className="rounded-xl p-3 bg-white shadow-lg border">
              <p className="text-xs text-slate-500">Satisfaction</p>
              <h4 className="text-base sm:text-lg font-bold text-slate-900">{satisfaction !== null ? `${satisfaction} ★` : '—'}</h4>
            </div>
          </div>
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="space-y-3 sm:space-y-4"
        >
          <div className="rounded-2xl p-4 sm:p-6 bg-white shadow-2xl border">
            <h3 className="text-sm sm:text-md font-semibold text-slate-900 mb-1">Quick Actions</h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-3">Tap to jump to common tasks</p>

            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={() => navigate(ROUTES.BOOK_HELPER)}
                disabled={!location}
                className="w-full flex items-center justify-between gap-3 rounded-lg px-4 py-3 bg-emerald-500 hover:scale-[1.01] transform transition shadow-lg active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-white/15 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-white">Request Helper</div>
                    <div className="text-xs text-white/80">Find verified helpers nearby</div>
                  </div>
                </div>
                <div className="text-white/90 font-semibold">Start</div>
              </Button>

              <Button
                onClick={() => navigate(ROUTES.HISTORY)}
                variant="outline"
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3"
              >
                <History className="w-5 h-5" />
                <span className="font-medium">History</span>
              </Button>

              <Button
                onClick={() => navigate(ROUTES.PROFILE)}
                variant="outline"
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3"
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Profile</span>
              </Button>

              <Button
                onClick={() => navigate(ROUTES.FAVORITES)}
                variant="outline"
                className="w-full rounded-lg px-4 py-3 flex items-center gap-3"
              >
                <img src={logo} alt="Favorites" className="w-5 h-5 object-contain" />
                <span className="font-medium">Favorites</span>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl p-4 sm:p-6 bg-gradient-to-b from-white to-slate-50 shadow-lg border">
            <h4 className="text-sm font-semibold text-slate-900">Need assistance?</h4>
            <p className="text-xs text-slate-500 mb-3">We'll connect you with nearby helpers within a 2 km radius.</p>
            <Button onClick={() => navigate(ROUTES.BOOK_HELPER)} className="w-full py-2">Request Now</Button>
          </div>
        </motion.aside>
      </div>

      <div className="fixed right-4 bottom-4 z-40 sm:right-6 sm:bottom-6">
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate(ROUTES.BOOK_HELPER)}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-white border-0"
          aria-label="Quick request helper"
        >
          <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.button>
      </div>
    </div>
  );
}

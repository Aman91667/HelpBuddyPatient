import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import type { ServiceHistory } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Calendar,  
  MapPin, 
  Star,
  Clock,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { format } from 'date-fns';

const HistoryPage = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ServiceHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<ServiceHistory>(`/services/history?page=${page}&limit=10`);
      if (response.success && response.data) {
        const raw = response.data as any;
        if (raw.services && Array.isArray(raw.services)) {
          raw.services = raw.services.map((svc: any) => {
            if (typeof svc.serviceType === 'string') {
              svc.serviceType = svc.serviceType.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
            return svc;
          });
        }
        setHistory(raw as ServiceHistory);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700';
      case 'CANCELLED':
        return 'bg-red-50 text-red-600';
      default:
        return 'bg-slate-50 text-slate-700';
    }
  };

  const services = history?.services ?? [];

  return (
    <div className="min-h-screen pb-6 bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="max-w-4xl mx-4 sm:mx-auto mt-4"
      >
        <div className="flex items-center gap-4 p-3 bg-white/60 backdrop-blur rounded-2xl shadow-md border">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-extrabold">Service History</h1>
            <p className="text-sm text-slate-500">{history?.pagination?.total ?? 0} total services</p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => { setPage(1); fetchHistory(); }} variant="outline">Refresh</Button>
            <Button onClick={() => navigate('/request')}>New request</Button>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <main className="max-w-4xl mx-4 sm:mx-auto mt-5">
        <ScrollArea className="h-[calc(100vh-160px)] px-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-pulse h-40 w-full rounded-2xl bg-slate-100" />
              <p className="text-sm text-slate-500 mt-4">Loading history...</p>
            </div>
          ) : services.length > 0 ? (
            <div className="space-y-3 py-3">
              {services.map((service, idx) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white rounded-2xl shadow-lg p-4 border cursor-pointer hover:shadow-xl"
                  onClick={() => { if (service.status === 'COMPLETED') navigate(`/service/${service.id}`); }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-1 rounded-lg text-xs font-semibold ${getStatusStyle(service.status)}`}>
                          {service.status}
                        </div>

                        <div className="text-sm font-semibold">{service.serviceType.join(', ')}</div>
                      </div>

                      <div className="mt-2 text-sm text-slate-500 flex items-center gap-3">
                        <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {format(new Date(service.createdAt), 'MMM dd, yyyy')}</div>
                        <div className="flex items-center gap-1"><Clock className="h-4 w-4" /> {format(new Date(service.createdAt), 'HH:mm')}</div>
                      </div>

                      {service.patientLocation?.landmark && (
                        <div className="mt-2 text-sm text-slate-500 flex items-center gap-2"><MapPin className="h-4 w-4" /> {service.patientLocation.landmark}</div>
                      )}

                      {service.helper && (
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-sm">Helper: <span className="font-medium">{service.helper.name}</span></div>
                          {service.rating && (
                            <div className="inline-flex items-center gap-2 text-amber-600">
                              <Star className="h-4 w-4" />
                              <div className="font-semibold">{service.rating}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {service.fare && (
                      <div className="ml-3 flex items-center flex-col text-right">
                        <div className="text-xs text-slate-400">Fare Paid</div>
                        <div className="text-lg font-bold text-slate-800">₹{service.fare.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Pagination compact */}
              {history?.pagination && history.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>

                  <div className="text-sm text-slate-600 px-3">Page {page} of {history.pagination.totalPages}</div>

                  <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(history.pagination.totalPages, p + 1))} disabled={page === history.pagination.totalPages}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="h-28 w-28 rounded-full bg-emerald-50 flex items-center justify-center">
                <Star className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-slate-600">You don't have any services yet</p>
              <Button onClick={() => navigate('/request')}>Request Your First Service</Button>
            </div>
          )}
        </ScrollArea>
      </main>
    </div>
  );
};

export default HistoryPage;

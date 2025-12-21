import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  Heart, 
  TrendingUp,
  Users,
  BarChart3,
  Calendar,
  Star
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiClient } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function PatientAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  
  // Analytics Data
  const [spendingAnalytics, setSpendingAnalytics] = useState<any[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<any[]>([]);
  const [favoriteHelpers, setFavoriteHelpers] = useState<any[]>([]);
  const [serviceFrequency, setServiceFrequency] = useState<any>(null);

  useEffect(() => {
    fetchAllAnalytics();
  }, []);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    try {
      const [spending, breakdown, favorites, frequency] = await Promise.all([
        apiClient.getPatientSpendingAnalytics(6),
        apiClient.getPatientServiceBreakdown(),
        apiClient.getFavoriteHelpers(5),
        apiClient.getServiceFrequency(),
      ]);

      if (spending.success && spending.data) {
        const data = spending.data as any;
        setSpendingAnalytics(data.monthlySpending || []);
      }

      if (breakdown.success && breakdown.data) {
        const data = breakdown.data as any;
        setServiceBreakdown(data.breakdown || []);
      }

      if (favorites.success && favorites.data) {
        const data = favorites.data as any;
        setFavoriteHelpers(data.favorites || []);
      }

      if (frequency.success && frequency.data) {
        setServiceFrequency(frequency.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Summary Stats
  const totalSpending = spendingAnalytics.reduce((sum, item) => sum + (item.totalSpent || 0), 0);
  const totalServices = serviceBreakdown.reduce((sum, item) => sum + (item.count || 0), 0);
  const avgPerService = totalServices > 0 ? totalSpending / totalServices : 0;

  const summaryCards = [
    {
      title: 'Total Spending',
      value: `₹${totalSpending.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      trend: 'Last 6 months',
    },
    {
      title: 'Total Services',
      value: totalServices.toString(),
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      trend: 'All time',
    },
    {
      title: 'Avg per Service',
      value: `₹${avgPerService.toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      trend: 'Average cost',
    },
    {
      title: 'Favorite Helpers',
      value: favoriteHelpers.length.toString(),
      icon: Heart,
      color: 'text-pink-500',
      bgColor: 'bg-pink-50',
      trend: 'Top helpers',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            📊 Analytics Dashboard
          </h1>
          <p className="text-slate-600">
            Track your spending and service usage
          </p>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {summaryCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="border-none shadow-lg overflow-hidden bg-gradient-to-br from-white to-slate-50">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-slate-600 mb-1">{card.title}</p>
                        <p className="text-3xl font-bold text-slate-900">{card.value}</p>
                        <p className="text-sm text-slate-500 mt-2">{card.trend}</p>
                      </div>
                      <div className={`p-3 rounded-xl ${card.bgColor}`}>
                        <Icon className={`h-6 w-6 ${card.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending Trends */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Monthly Spending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={spendingAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#64748b"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#64748b"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="totalSpent" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Spending (₹)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Service Type Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  Service Type Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={serviceBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="serviceType"
                    >
                      {serviceBreakdown.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Favorite Helpers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Top Helpers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {favoriteHelpers.length > 0 ? (
                    favoriteHelpers.map((helper, index) => (
                      <motion.div
                        key={helper.helperId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + index * 0.1 }}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              Helper #{helper.helperId.slice(-8)}
                            </p>
                            <p className="text-sm text-slate-600">
                              {helper.serviceCount} services
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold">
                              {helper.averageRating?.toFixed(1) || 'N/A'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            ₹${helper.totalSpent?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No favorite helpers yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Service Frequency */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-500" />
                  Service Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                {serviceFrequency ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl">
                        <p className="text-sm text-emerald-700 mb-1">Total Services</p>
                        <p className="text-2xl font-bold text-emerald-900">
                          {serviceFrequency.totalServices || 0}
                        </p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                        <p className="text-sm text-blue-700 mb-1">Avg per Month</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {serviceFrequency.averagePerMonth?.toFixed(1) || '0'}
                        </p>
                      </div>
                    </div>

                    {serviceFrequency.dayOfWeekBreakdown && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">
                          Day of Week
                        </h4>
                        <ResponsiveContainer width="100%" height={150}>
                          <BarChart data={serviceFrequency.dayOfWeekBreakdown}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="day" 
                              stroke="#64748b"
                              style={{ fontSize: '10px' }}
                            />
                            <YAxis 
                              stroke="#64748b"
                              style={{ fontSize: '10px' }}
                            />
                            <Tooltip />
                            <Bar 
                              dataKey="count" 
                              fill="#f59e0b" 
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No service data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

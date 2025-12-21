import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import type { Service } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Star, Clock, IndianRupee, CreditCard, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const PaymentPage = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    fetchServiceDetails();
  }, [serviceId]);

  const fetchServiceDetails = async () => {
    if (!serviceId) return;
    
    const response = await apiClient.get<Service>(`/services/${serviceId}`);
    if (response.success && response.data) {
      setService(response.data);
      // Check if payment is already completed
      if ((response.data as any).paymentStatus === 'COMPLETED') {
        setPaymentCompleted(true);
      }
    }
  };

  const handlePayment = async () => {
    if (!serviceId || !paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const response = await apiClient.post(`/services/${serviceId}/payment`, {
        paymentMethod,
      });

      if (response.success) {
        setPaymentCompleted(true);
        toast.success('Payment completed successfully!');
        // Refresh service data
        fetchServiceDetails();
        // Show rating section after payment
        setTimeout(() => {
          const ratingSection = document.getElementById('rating-section');
          if (ratingSection) {
            ratingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      } else {
        toast.error(response.error || 'Failed to process payment');
      }
    } catch (error) {
      toast.error('Failed to process payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!serviceId) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post(`/services/${serviceId}/rate`, {
        rating,
        review: review.trim() || undefined,
      });

      if (response.success) {
        toast.success('Thank you for your feedback!');
        navigate('/');
      } else {
        toast.error(response.error || 'Failed to submit rating');
      }
    } catch (error) {
      toast.error('Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // Calculate bill breakdown
  const billedMinutes = (service as any).billedMinutes || 0;
  const platformCharge = 15;
  const serviceCharge = billedMinutes * 2.5;
  const totalFare = service.fare || (platformCharge + serviceCharge);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 p-4 py-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl mx-auto space-y-6"
      >
        {/* Success Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="flex justify-center mb-4"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
          </motion.div>
          <h1 className="text-3xl font-bold mb-2">Service Completed!</h1>
          <p className="text-slate-600">Thank you for using HelpBudy</p>
        </motion.div>

        {/* Bill Breakdown Card */}
        <Card className="border-2 border-emerald-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Service Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium">Service Time</span>
                </div>
                <span className="font-semibold">{billedMinutes} minutes</span>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Service Charge ({billedMinutes} min × ₹2.5)</span>
                  <span className="font-medium">₹{serviceCharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Platform Fee</span>
                  <span className="font-medium">₹{platformCharge.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t-2 border-emerald-200">
                <span className="text-lg font-bold">Total Amount</span>
                <span className="text-2xl font-bold text-emerald-600">₹{totalFare.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selection */}
            {!paymentCompleted && (
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-semibold">Select Payment Method</Label>
                <RadioGroup value={paymentMethod || ''} onValueChange={(value) => setPaymentMethod(value as 'CASH' | 'UPI')}>
                  <div className="flex gap-4">
                    <Label
                      htmlFor="cash"
                      className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        paymentMethod === 'CASH'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <RadioGroupItem value="CASH" id="cash" className="sr-only" />
                      <div className="flex items-center gap-3">
                        <Wallet className="h-6 w-6 text-emerald-600" />
                        <div>
                          <div className="font-semibold">Cash</div>
                          <div className="text-xs text-slate-500">Pay directly to helper</div>
                        </div>
                      </div>
                    </Label>

                    <Label
                      htmlFor="upi"
                      className={`flex-1 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        paymentMethod === 'UPI'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <RadioGroupItem value="UPI" id="upi" className="sr-only" />
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-6 w-6 text-emerald-600" />
                        <div>
                          <div className="font-semibold">UPI</div>
                          <div className="text-xs text-slate-500">Pay via UPI</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                <Button
                  onClick={handlePayment}
                  disabled={!paymentMethod || isProcessingPayment}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isProcessingPayment ? 'Processing...' : `Pay ₹${totalFare.toFixed(2)}`}
                </Button>
              </div>
            )}

            {paymentCompleted && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Payment Completed</span>
                </div>
                <p className="text-sm text-emerald-600 mt-1">
                  Paid via {(service as any).paymentMethod || 'Cash'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rating Section - Only shows after payment */}
        {paymentCompleted && (
          <Card id="rating-section">
            <CardHeader>
              <CardTitle>Rate Your Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="font-semibold mb-3">How was your experience?</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                      key={star}
                      type="button"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setRating(star)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`h-10 w-10 transition-colors ${
                          star <= rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <Textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share your experience (optional)"
                  className="bg-slate-50"
                  maxLength={500}
                />
              </div>

              <Button
                onClick={handleSubmitRating}
                disabled={isSubmitting}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? 'Submitting...' : 'Submit & Continue'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="w-full"
              >
                Skip
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
};

export default PaymentPage;

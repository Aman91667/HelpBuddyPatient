import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Loader2, Mail, Phone } from 'lucide-react';
import logo from '@/assets/logo.png';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate } from 'react-router-dom';
import OTPPopup from '@/components/OTPPopup';

const otpRequestSchema = z.object({
  value: z.string()
    .min(1, 'Required')
    .regex(/^[6-9]\d{9}$/, 'Phone number must be a valid 10-digit Indian mobile number (starting with 6-9)'),
  name: z.string().optional(),
});

const otpVerifySchema = z.object({
  code: z.string().length(6, 'OTP must be 6 digits'),
});

type OTPRequestForm = z.infer<typeof otpRequestSchema>;
type OTPVerifyForm = z.infer<typeof otpVerifySchema>;

export default function AuthPage() {
  const { requestOTP, verifyOTP, isAuthenticated } = useAuth();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [contactType, setContactType] = useState<'PHONE' | 'EMAIL'>('PHONE');
  const [contactValue, setContactValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOTPPopup, setShowOTPPopup] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const requestForm = useForm<OTPRequestForm>({ resolver: zodResolver(otpRequestSchema) });
  const verifyForm = useForm<OTPVerifyForm>({ resolver: zodResolver(otpVerifySchema) });

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleRequestOTP = async (data: OTPRequestForm) => {
    setIsLoading(true);
    const result = await requestOTP({ type: contactType, value: data.value });
    setIsLoading(false);
    if (result.success) { 
      setContactValue(data.value);
      setStep('verify');
      // Show OTP popup if code is returned
      if (result.code) {
        setOtpCode(result.code);
        setShowOTPPopup(true);
      }
    }
  };

  const handleVerifyOTP = async (data: OTPVerifyForm) => {
    setIsLoading(true);
    await verifyOTP({ type: contactType, value: contactValue, code: data.code, name: requestForm.getValues('name') });
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white py-8 px-4 sm:py-12">
      <motion.div initial={{ scale: 0.995, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-3xl shadow-2xl rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 bg-white">

        {/* LEFT: decorative panel - hidden on mobile */}
        <aside className="hidden lg:flex flex-col justify-center p-8 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white gap-6">
          <div>
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                <img src={logo} alt="HelpBudy Logo" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold">Welcome to HelpBudy</h2>
                <p className="text-sm opacity-90 mt-1">On-demand helpers for hospitals</p>
              </div>
            </div>

            <h3 className="text-3xl font-bold leading-tight mb-2">Fast. Caring. Local.</h3>
            <p className="max-w-xs text-sm opacity-90">Request verified helpers for navigation, wheelchair support and more — right from your phone.</p>
          </div>

          <div className="mt-auto">
            <div className="bg-white/10 rounded-xl p-3">
              <div className="text-xs uppercase font-semibold text-white/90">Tip</div>
              <div className="text-sm mt-2">Use your phone for faster verification and SMS updates.</div>
            </div>
          </div>
        </aside>

        {/* RIGHT: form area (mobile-first) */}
        <main className="p-6 sm:p-8 lg:p-10 bg-white">
          <div className="max-w-md mx-auto">

            {/* Mobile header with logo (visible on small screens) */}
            <div className="flex items-center justify-center mb-6 lg:hidden">
              <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center overflow-hidden">
                <img src={logo} alt="HelpBudy" className="w-10 h-10 object-contain" />
              </div>
            </div>

            <div className="text-center mb-4">
              <h1 className="text-xl sm:text-2xl font-bold mb-1">{step === 'request' ? 'Get started' : 'Verify OTP'}</h1>
              <p className="text-sm text-slate-500">{step === 'request' ? 'Sign in quickly using phone or email' : `We sent an OTP to ${contactValue}`}</p>
            </div>

            <AnimatePresence mode="wait">
              {step === 'request' ? (
                <motion.form key="request" onSubmit={requestForm.handleSubmit(handleRequestOTP)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

                  <div>
                    <Label className="text-sm">Name (optional)</Label>
                    <Input {...requestForm.register('name')} placeholder="Your name" className="form-input mt-1" />
                  </div>

                  {/* Compact sliding switch for contact type */}
                  <div className="relative mt-1">
                    <div className="relative bg-slate-100 rounded-xl p-1 flex">
                      {/* sliding highlight */}
                      <div
                        aria-hidden
                        className="absolute top-1 bottom-1 w-1/2 rounded-lg bg-white shadow transition-transform duration-300"
                        style={{ transform: contactType === 'PHONE' ? 'translateX(0%)' : 'translateX(100%)' }}
                      />

                      <button
                        type="button"
                        onClick={() => setContactType('PHONE')}
                        className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${contactType === 'PHONE' ? 'text-emerald-600' : 'text-slate-600'}`}
                      >
                        <Phone className="h-4 w-4" /> Phone
                      </button>

                      <button
                        type="button"
                        onClick={() => setContactType('EMAIL')}
                        className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${contactType === 'EMAIL' ? 'text-emerald-600' : 'text-slate-600'}`}
                      >
                        <Mail className="h-4 w-4" /> Email
                      </button>
                    </div>
                  </div>

                  {/* Inputs (switch via TabsContent for accessibility) */}
                  <Tabs value={contactType}>
                    <TabsContent value="PHONE" className="pt-3">
                      <Label className="text-sm">Phone Number</Label>
                      <Input 
                        {...requestForm.register('value')} 
                        type="tel" 
                        inputMode="numeric" 
                        maxLength={10}
                        placeholder="9876543210" 
                        className="form-input mt-1" 
                      />
                      <p className="text-xs text-slate-500 mt-1">Enter 10-digit mobile number (starting with 6-9)</p>
                      {requestForm.formState.errors.value && <p className="text-sm text-destructive mt-1">{requestForm.formState.errors.value.message}</p>}
                    </TabsContent>

                    <TabsContent value="EMAIL" className="pt-3">
                      <Label className="text-sm">Email Address</Label>
                      <Input {...requestForm.register('value')} type="email" inputMode="email" placeholder="you@domain.com" className="form-input mt-1" />
                      {requestForm.formState.errors.value && <p className="text-sm text-destructive mt-1">{requestForm.formState.errors.value.message}</p>}
                    </TabsContent>
                  </Tabs>

                  <Button type="submit" className="w-full btn-glass-primary h-12 mt-2" disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>) : 'Send OTP'}
                  </Button>
                </motion.form>
              ) : (
                <motion.form key="verify" onSubmit={verifyForm.handleSubmit(handleVerifyOTP)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <div>
                    <Label className="text-sm">Enter OTP</Label>
                    <Input {...verifyForm.register('code')} type="tel" inputMode="numeric" placeholder="000000" maxLength={6} className="form-input otp-input mt-1 text-center text-2xl" />
                    {verifyForm.formState.errors.code && <p className="text-sm text-destructive mt-1 text-center">{verifyForm.formState.errors.code.message}</p>}
                  </div>

                  <Button type="submit" className="w-full btn-glass-primary h-12" disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</>) : 'Verify OTP'}
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1" onClick={() => setStep('request')}>Back</Button>
                    <Button variant="outline" className="flex-1" onClick={() => { /* TODO: resend logic */ }}>Resend</Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="mt-6 text-xs text-center text-slate-400">By signing in you agree to our Terms of Service and Privacy Policy.</div>
          </div>
        </main>
      </motion.div>

      {/* OTP Popup */}
      {showOTPPopup && otpCode && (
        <OTPPopup
          otp={otpCode}
          phone={contactValue}
          onClose={() => setShowOTPPopup(false)}
          duration={30000} // 30 seconds
        />
      )}
    </div>
  );
}

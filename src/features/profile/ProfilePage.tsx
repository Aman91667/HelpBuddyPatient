import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Star, 
  Calendar,
  LogOut,
  Edit2,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import logo from '@/assets/logo.png';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-8 pb-safe">
      {/* Header with logo */}
      <motion.header
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="max-w-3xl mx-4 sm:mx-auto mt-4"
      >
        <div className="flex items-center gap-3 p-3 bg-white/60 backdrop-blur rounded-2xl shadow-md border">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-3 flex-1">
            <div className="w-11 h-11 rounded-md bg-white p-1 flex items-center justify-center shadow-sm">
              <img src={logo} alt="HelpBudy" className="w-full h-full object-contain" />
            </div>

            <div>
              <h1 className="text-lg sm:text-xl font-extrabold">Profile</h1>
              <p className="text-sm text-slate-600">Your account & preferences</p>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={logout} className="rounded-full">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </motion.header>

      {/* Profile card */}
      <motion.main
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="max-w-3xl mx-4 sm:mx-auto mt-5"
      >
        <div className="bg-white rounded-2xl shadow-2xl p-5 border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-28 w-28">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                ) : (
                  <AvatarFallback className="bg-emerald-50 text-emerald-600 text-4xl">
                    {user.name.charAt(0)}
                  </AvatarFallback>
                )}
              </Avatar>

              <div>
                <h2 className="text-2xl font-bold">{user.name}</h2>
                <p className="text-sm text-slate-500 mt-1">{user.type}</p>

                {user.rating && (
                  <div className="mt-2 inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full">
                    <Star className="h-4 w-4" />
                    <span className="font-semibold">{user.rating.toFixed(1)}</span>
                    <span className="text-xs text-slate-500">· {user.totalServices || 0} services</span>
                  </div>
                )}
              </div>
            </div>

            <div className="ml-auto flex gap-2">
              <Button onClick={() => navigate('/edit-profile')} className="px-4 py-2 rounded-lg flex items-center gap-2">
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>

              <Button variant="outline" onClick={() => navigate('/my-services')} className="px-4 py-2 rounded-lg flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                My services
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {user.email && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                <Mail className="h-5 w-5 text-slate-600" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Email</p>
                  <a href={`mailto:${user.email}`} className="font-medium block truncate">{user.email}</a>
                </div>
              </div>
            )}

            {user.phone && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
                <Phone className="h-5 w-5 text-slate-600" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500">Phone</p>
                  <a href={`tel:${user.phone}`} className="font-medium">{user.phone}</a>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
              <Calendar className="h-5 w-5 text-slate-600" />
              <div className="flex-1">
                <p className="text-xs text-slate-500">Member since</p>
                <p className="font-medium">{format(new Date(user.createdAt), 'MMMM dd, yyyy')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
              <div className="h-5 w-5 flex items-center justify-center text-slate-600">⭐</div>
              <div className="flex-1">
                <p className="text-xs text-slate-500">Reputation</p>
                <p className="font-medium">{user.reputation || '—'}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button className="w-full sm:w-auto flex-1" onClick={() => navigate('/support')}>Contact support</Button>
            <Button variant="destructive" className="w-full sm:w-auto" onClick={logout}>Logout</Button>
          </div>
        </div>
      </motion.main>
    </div>
  );
};

export default ProfilePage;

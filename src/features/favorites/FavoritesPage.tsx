import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Star, Heart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface FavoriteHelper {
  id: string;
  name: string;
  rating: number;
  totalServices: number;
}

const FavoritesPage = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteHelper[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    setIsLoading(true);
    try {
      // Use analytics endpoint which already exists
      const response = await apiClient.get<any>('/analytics/patient/favorite-helpers?limit=50');
      if (response.success && response.data) {
        // Transform the response to match FavoriteHelper interface
        const favoritesData = (response.data as any[]).map((item: any) => ({
          id: item.helper?.id || '',
          name: item.helper?.name || 'Unknown Helper',
          rating: item.avgRating || 0,
          totalServices: item.serviceCount || 0,
        }));
        setFavorites(favoritesData);
      }
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFavorite = async (helperId: string) => {
    try {
      const resp = await apiClient.delete(`/patients/favorites/${helperId}`);
      if (resp && resp.success) {
        setFavorites(favorites.filter(f => f.id !== helperId));
        toast.success('Removed from favorites');
      } else {
        toast.error(resp?.error || 'Failed to remove favorite');
      }
    } catch (e) {
      console.error('Failed to remove favorite:', e);
      toast.error('Failed to remove favorite');
    }
  };

  return (
    <div className="min-h-screen pb-6 pb-safe">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="card-glass m-4 p-4"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Favorite Helpers</h1>
            <p className="text-sm text-muted-foreground">
              {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </motion.header>

      {/* Favorites List */}
      <div className="mx-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : favorites.length > 0 ? (
          favorites.map((helper, index) => (
            <motion.div
              key={helper.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card-glass p-4"
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {helper.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{helper.name}</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 text-accent">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-medium">{helper.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {helper.totalServices} services
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFavorite(helper.id)}
                  className="rounded-full text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 card-glass">
            <Heart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No favorite helpers yet</p>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Add helpers to favorites after completing a service
            </p>
            <Button onClick={() => navigate('/')}>
              Go Home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;

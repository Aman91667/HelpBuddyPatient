import type { ServiceType } from '@/types';
import { motion } from 'framer-motion';
import { 
  Users, 
  Navigation, 
  Package, 
  Accessibility, 
  Heart, 
  Languages 
} from 'lucide-react';

const SERVICE_TYPES: Array<{
  type: ServiceType;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    type: 'QUEUE',
    label: 'Queue Management',
    icon: <Users className="h-6 w-6" />,
    description: 'Help with waiting in lines',
  },
  {
    type: 'GUIDANCE',
    label: 'Navigation',
    icon: <Navigation className="h-6 w-6" />,
    description: 'Guide to departments and facilities',
  },
  {
    type: 'CARRY_ITEMS',
    label: 'Carry Items',
    icon: <Package className="h-6 w-6" />,
    description: 'Help carrying belongings or reports',
  },
  {
    type: 'WHEELCHAIR',
    label: 'Wheelchair Assistance',
    icon: <Accessibility className="h-6 w-6" />,
    description: 'Wheelchair support and mobility help',
  },
  {
    type: 'MEDICAL_ASSIST',
    label: 'Medical Support',
    icon: <Heart className="h-6 w-6" />,
    description: 'Basic medical or first aid help',
  },
  {
    type: 'TRANSLATION',
    label: 'Translation',
    icon: <Languages className="h-6 w-6" />,
    description: 'Help with translation and communication',
  },
];

interface ServiceTypeSelectorProps {
  selected: ServiceType[];
  onChange: (types: ServiceType[]) => void;
}

export const ServiceTypeSelector = ({ selected, onChange }: ServiceTypeSelectorProps) => {
  const toggleType = (type: ServiceType) => {
    if (selected.includes(type)) {
      onChange(selected.filter((t) => t !== type));
    } else {
      onChange([...selected, type]);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {SERVICE_TYPES.map((service) => {
        const isSelected = selected.includes(service.type);

        return (
          <motion.button
            key={service.type}
            type="button"
            onClick={() => toggleType(service.type)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`
              p-4 text-left rounded-2xl border transition-all duration-200
              ${isSelected
                ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-400 shadow-lg ring-1 ring-emerald-500/30'
                : 'bg-white/70 border-slate-200 hover:border-emerald-400 hover:shadow-md'}
            `}
          >
            <div className="flex items-start gap-3">
              <div
                className={`rounded-lg p-2 transition-colors duration-300 shadow-sm ${
                  isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {service.icon}
              </div>

              <div className="flex-1 min-w-0">
                <h3
                  className={`font-semibold text-sm mb-0.5 truncate ${
                    isSelected ? 'text-slate-900' : 'text-slate-700'
                  }`}
                >
                  {service.label}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2">{service.description}</p>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

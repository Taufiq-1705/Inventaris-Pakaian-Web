import React, { useEffect, useState } from 'react';

interface WarehouseCardProps {
  title: string;
  description: string;
  icon: string;
  currentValue: number;
  maxValue: number;
  percentage: number;
  colorType: 'primary' | 'secondary' | 'tertiary' | 'error';
  statusLabel: string;
  locationLabel: string;
}

const WarehouseCard: React.FC<WarehouseCardProps> = ({
  title,
  description,
  icon,
  currentValue,
  maxValue,
  percentage,
  colorType,
  statusLabel,
  locationLabel
}) => {
  const [width, setWidth] = useState('0%');

  useEffect(() => {
    // Animate progress bar on load
    const timer = setTimeout(() => {
      setWidth(`${percentage}%`);
    }, 300);
    return () => clearTimeout(timer);
  }, [percentage]);

  const colorClass = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    tertiary: 'bg-tertiary',
    error: 'bg-error',
  }[colorType];
  
  const textColorClass = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary',
    error: 'text-error font-bold',
  }[colorType];

  const statusBgClass = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
    tertiary: 'bg-tertiary/10 text-tertiary border-tertiary/20',
    error: 'bg-error/10 text-error border-error/20',
  }[colorType];

  return (
    <div className="glass-card p-6 rounded-xl relative overflow-hidden hover:-translate-y-[2px] transition-transform duration-200 ease-out">
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10 -mr-8 -mt-8">
        <span className="material-symbols-outlined text-[120px]">{icon}</span>
      </div>
      <div className="mb-4">
        <h3 className="font-title-sm text-title-sm text-on-surface">{title}</h3>
        <p className="text-body-sm text-on-surface-variant">{description}</p>
      </div>
      <div className="flex justify-between items-end mb-2">
        <div className="text-mono-data text-primary">{currentValue.toLocaleString()} / {maxValue.toLocaleString()} Pcs</div>
        <div className={`font-bold ${colorType === 'error' ? 'text-error' : 'text-on-surface'}`}>{percentage}%</div>
      </div>
      <div className="h-3 w-full bg-surface-container-highest rounded-full overflow-hidden mb-4">
        <div className={`h-full ${colorClass} rounded-full transition-all duration-1000`} style={{ width }}></div>
      </div>
      <div className="flex gap-2">
        <span className={`px-2 py-1 text-[10px] rounded border ${statusBgClass}`}>{statusLabel}</span>
        <span className="px-2 py-1 bg-surface-variant text-on-surface-variant text-[10px] rounded border border-outline-variant">{locationLabel}</span>
      </div>
    </div>
  );
};

export default WarehouseCard;

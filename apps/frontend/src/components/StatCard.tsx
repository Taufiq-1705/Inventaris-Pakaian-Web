import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: React.ReactNode;
  icon: string;
  colorType: 'primary' | 'secondary' | 'tertiary' | 'error';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, colorType }) => {
  const bgColorClass = {
    primary: 'bg-primary-container/10 text-primary',
    secondary: 'bg-secondary-container/10 text-secondary',
    tertiary: 'bg-tertiary-container/10 text-tertiary',
    error: 'bg-error-container/10 text-error',
  }[colorType];

  return (
    <div className="glass-card p-5 rounded-xl hover:-translate-y-[2px] transition-transform duration-200 ease-out">
      <div className="flex justify-between items-start mb-2">
        <span className="text-on-surface-variant font-label-caps text-label-caps">{title}</span>
        <div className={`p-2 rounded ${bgColorClass}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>
      <div className="font-display-lg text-display-lg mb-1">{value}</div>
      <div className="text-body-sm text-on-surface-variant">{subtitle}</div>
    </div>
  );
};

export default StatCard;

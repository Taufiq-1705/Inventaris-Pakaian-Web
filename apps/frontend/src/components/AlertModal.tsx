import React from 'react';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  variant?: 'success' | 'error' | 'warning' | 'info';
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  onClose,
  variant = 'info',
}) => {
  if (!isOpen) return null;

  const config = {
    success: {
      icon: 'check_circle',
      iconBg: 'bg-secondary/15',
      iconColor: 'text-secondary',
      btnBg: 'bg-secondary hover:bg-secondary/90 text-on-secondary',
    },
    error: {
      icon: 'error',
      iconBg: 'bg-error/15',
      iconColor: 'text-error',
      btnBg: 'bg-error hover:bg-error/90 text-on-error',
    },
    warning: {
      icon: 'warning',
      iconBg: 'bg-tertiary/15',
      iconColor: 'text-tertiary',
      btnBg: 'bg-tertiary hover:bg-tertiary/90 text-on-tertiary',
    },
    info: {
      icon: 'info',
      iconBg: 'bg-primary/15',
      iconColor: 'text-primary',
      btnBg: 'bg-primary hover:bg-primary/90 text-on-primary',
    },
  }[variant];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-surface-container rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className={`w-14 h-14 rounded-full ${config.iconBg} flex items-center justify-center`}>
            <span className={`material-symbols-outlined text-3xl ${config.iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
              {config.icon}
            </span>
          </div>
          <div>
            <h3 className="font-display-md text-base font-bold text-on-surface mb-2">{title}</h3>
            <p className="text-body-sm text-on-surface-variant leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-center">
          <button
            onClick={onClose}
            className={`w-full py-2.5 rounded-lg font-medium transition-all active:scale-95 shadow-sm ${config.btnBg}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

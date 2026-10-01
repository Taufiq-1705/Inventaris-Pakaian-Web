import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  variant = 'danger',
}) => {
  if (!isOpen) return null;

  const iconBg = variant === 'danger' ? 'bg-error/10' : 'bg-tertiary/10';
  const iconColor = variant === 'danger' ? 'text-error' : 'text-tertiary';
  const btnBg = variant === 'danger'
    ? 'bg-error hover:bg-error/90 text-on-error'
    : 'bg-tertiary hover:bg-tertiary/90 text-on-tertiary';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="bg-surface-container rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Body */}
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className={`w-16 h-16 rounded-full ${iconBg} flex items-center justify-center`}>
            <span className={`material-symbols-outlined text-3xl ${iconColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>
              {variant === 'danger' ? 'delete_forever' : 'warning'}
            </span>
          </div>
          <div>
            <h3 className="font-display-md text-lg text-on-surface mb-2">{title}</h3>
            <p className="text-body-sm text-on-surface-variant leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant font-medium hover:bg-surface-variant transition-all active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all active:scale-95 ${btnBg}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

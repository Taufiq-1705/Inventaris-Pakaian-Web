import React, { useState, useEffect } from 'react';
import { api, type ItemData, type WarehouseStats } from '../lib/api';

interface UpdateStockModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const UpdateStockModal: React.FC<UpdateStockModalProps> = ({ onClose, onSuccess }) => {
  const [warehouses, setWarehouses] = useState<WarehouseStats[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  // Fetch warehouses on mount
  useEffect(() => {
    api<{ warehouses: WarehouseStats[] }>('/api/warehouses')
      .then(data => setWarehouses(data.warehouses))
      .catch(console.error);
  }, []);

  // Fetch items when warehouse changes
  useEffect(() => {
    if (!selectedWarehouseId) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    setSelectedItemId('');
    api<{ items: ItemData[]; pagination: any }>(`/api/items?warehouse=${selectedWarehouseId}&limit=100`)
      .then(data => setItems(data.items))
      .catch(console.error)
      .finally(() => setLoadingItems(false));
  }, [selectedWarehouseId]);

  const currentItem = items.find(i => String(i.id) === selectedItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!selectedItemId || !quantity || quantity <= 0) {
      setError('Pilih barang dan masukkan jumlah yang valid.');
      return;
    }

    const adjustment = adjustmentType === 'add' ? quantity : -quantity;

    setSaving(true);
    try {
      const result = await api<{ message: string }>(`/api/items/${selectedItemId}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({ adjustment }),
      });
      setSuccessMsg(result.message);
      setQuantity('');
      setSelectedItemId('');

      // Refresh items list for the current warehouse
      const data = await api<{ items: ItemData[]; pagination: any }>(`/api/items?warehouse=${selectedWarehouseId}&limit=100`);
      setItems(data.items);

      // After 2 seconds, close and refresh dashboard
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui stok');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-surface-container rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">inventory</span>
            </div>
            <div>
              <h3 className="font-display-md text-lg text-on-surface">Perbarui Stok Barang</h3>
              <p className="text-xs text-on-surface-variant">Tambah atau kurangi jumlah stok</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form id="update-stock-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-error/10 text-error p-3 rounded-lg border border-error/20 flex gap-2 items-center text-sm">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                {error}
              </div>
            )}
            {successMsg && (
              <div className="bg-secondary/10 text-secondary p-3 rounded-lg border border-secondary/20 flex gap-2 items-center text-sm">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {successMsg}
              </div>
            )}

            {/* Select Warehouse */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pilih Gudang</label>
              <div className="relative">
                <select
                  className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none appearance-none"
                  value={selectedWarehouseId}
                  onChange={e => setSelectedWarehouseId(e.target.value)}
                  required
                >
                  <option value="" disabled>Pilih gudang...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={String(w.id)}>{w.name} — {w.description || ''}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">warehouse</span>
              </div>
            </div>

            {/* Select Item */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pilih Barang</label>
              <div className="relative">
                <select
                  className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none appearance-none disabled:opacity-50"
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                  disabled={!selectedWarehouseId || loadingItems}
                  required
                >
                  <option value="" disabled>
                    {loadingItems ? 'Memuat barang...' : !selectedWarehouseId ? 'Pilih gudang terlebih dahulu' : 'Pilih barang...'}
                  </option>
                  {items.map(item => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name} — {item.code} (Stok: {item.quantity} pcs)
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">checkroom</span>
              </div>
            </div>

            {/* Current Stock Info */}
            {currentItem && (
              <div className="bg-surface-container-high p-4 rounded-lg border border-outline-variant flex items-center justify-between">
                <div>
                  <p className="text-xs text-on-surface-variant uppercase font-bold tracking-wider">Stok Saat Ini</p>
                  <p className="text-2xl font-mono-data text-on-surface">{currentItem.quantity} <span className="text-sm text-on-surface-variant">pcs</span></p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                  currentItem.status === 'AMAN' ? 'bg-secondary/10 text-secondary' :
                  currentItem.status === 'MENIPIS' ? 'bg-tertiary/10 text-tertiary' :
                  'bg-error/10 text-error'
                }`}>
                  {currentItem.status}
                </span>
              </div>
            )}

            {/* Adjustment Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tipe Adjustment</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('add')}
                  className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                    adjustmentType === 'add'
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-outline-variant text-on-surface-variant hover:border-secondary/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  Tambah Stok
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('subtract')}
                  className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 font-bold transition-all ${
                    adjustmentType === 'subtract'
                      ? 'border-error bg-error/10 text-error'
                      : 'border-outline-variant text-on-surface-variant hover:border-error/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">remove_circle</span>
                  Kurangi Stok
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Jumlah (Pcs)</label>
              <input
                type="number"
                min="1"
                className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none font-mono-data text-xl"
                placeholder="0"
                value={quantity}
                onChange={e => setQuantity(e.target.value ? parseInt(e.target.value) : '')}
                required
              />
              {currentItem && adjustmentType === 'subtract' && typeof quantity === 'number' && quantity > 0 && (
                <p className="text-xs text-on-surface-variant">
                  Stok setelah pengurangan: <span className={`font-bold ${currentItem.quantity - quantity < 0 ? 'text-error' : 'text-on-surface'}`}>{currentItem.quantity - quantity} pcs</span>
                </p>
              )}
              {currentItem && adjustmentType === 'add' && typeof quantity === 'number' && quantity > 0 && (
                <p className="text-xs text-on-surface-variant">
                  Stok setelah penambahan: <span className="font-bold text-secondary">{currentItem.quantity + quantity} pcs</span>
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-high flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg font-bold text-on-surface-variant hover:bg-surface-variant transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            form="update-stock-form"
            disabled={saving || !!successMsg}
            className={`px-6 py-2.5 rounded-lg font-bold text-white hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 ${
              adjustmentType === 'add' ? 'bg-secondary' : 'bg-error'
            }`}
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                Memproses...
              </>
            ) : successMsg ? (
              <>
                <span className="material-symbols-outlined text-[18px]">check</span>
                Berhasil!
              </>
            ) : (
              adjustmentType === 'add' ? 'Tambah Stok' : 'Kurangi Stok'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

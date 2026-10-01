import React, { useState, useEffect } from 'react';
import { api, type ItemData, type CategoryData, type WarehouseStats } from '../lib/api';

interface EditItemModalProps {
  itemId: number;
  onClose: () => void;
  onSuccess: () => void;
  categories: CategoryData[];
  warehouses: WarehouseStats[];
}

export const EditItemModal: React.FC<EditItemModalProps> = ({ 
  itemId, 
  onClose, 
  onSuccess,
  categories,
  warehouses
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [typeId, setTypeId] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch full item details when modal opens
  useEffect(() => {
    const fetchItem = async () => {
      try {
        const data = await api<any>(`/api/items/${itemId}`);
        setCode(data.code);
        setName(data.name);
        
        // Match category by slug
        if (data.category) {
          setCategorySlug(data.category.slug);
        }
        
        if (data.itemTypeId) {
          setTypeId(String(data.itemTypeId));
        }
        
        setSize(data.size);
        setQuantity(data.quantity);
        
        if (data.warehouseId) {
          setWarehouseId(String(data.warehouseId));
        }
        
        setNotes(data.notes || '');
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data barang');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [itemId]);

  const currentCategory = categories.find(c => c.slug === categorySlug);
  const currentTypes = currentCategory?.types || [];

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategorySlug(e.target.value);
    setTypeId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    
    try {
      await api(`/api/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({
          code,
          name,
          categoryId: currentCategory?.id,
          itemTypeId: typeId ? parseInt(typeId) : undefined,
          size,
          quantity,
          warehouseId: warehouseId ? parseInt(warehouseId) : undefined,
          notes: notes || undefined,
        }),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan perubahan');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="bg-surface-container rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-high">
          <h3 className="font-display-md text-lg text-on-surface">Edit Data Barang</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <span className="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
              <p className="text-on-surface-variant">Memuat data...</p>
            </div>
          ) : (
            <form id="edit-form" onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-error/10 text-error p-4 rounded-lg border border-error/20 flex gap-3">
                  <span className="material-symbols-outlined">warning</span>
                  <p className="font-medium text-sm">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Kode Barang</label>
                  <input 
                    className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" 
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nama Barang</label>
                  <input 
                    className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Kategori</label>
                  <select 
                    className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none appearance-none" 
                    value={categorySlug}
                    onChange={handleCategoryChange}
                    required
                  >
                    <option value="" disabled>Pilih Kategori</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tipe</label>
                  <select 
                    className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none appearance-none disabled:opacity-50" 
                    value={typeId}
                    onChange={e => setTypeId(e.target.value)}
                    disabled={!categorySlug}
                    required
                  >
                    <option value="" disabled>Pilih Tipe</option>
                    {currentTypes.map(t => (
                      <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ukuran</label>
                  <div className="flex gap-2">
                    {['S', 'M', 'L', 'XL', 'XXL'].map(s => (
                      <button 
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`px-4 py-2 rounded-lg border text-sm font-bold transition-all flex-1
                          ${size === s ? 'bg-primary text-on-primary border-primary shadow-sm' : 'border-outline-variant hover:border-primary hover:text-primary text-on-surface-variant'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Jumlah Stok</label>
                  <input 
                    type="number"
                    min="0"
                    className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none font-mono-data" 
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Lokasi Gudang</label>
                <select 
                  className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none appearance-none" 
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                  required
                >
                  <option value="" disabled>Pilih Gudang</option>
                  {warehouses.map(w => {
                    const isAllowed = categorySlug ? (!w.allowedCategoryId || w.allowedCategoryId === currentCategory?.id) : true;
                    return (
                      <option key={w.id} value={String(w.id)} disabled={!isAllowed}>
                        {w.name} {!isAllowed ? '(Tidak Sesuai Kategori)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Catatan Tambahan</label>
                <textarea 
                  className="w-full bg-background border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none resize-none" 
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </form>
          )}
        </div>

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
            form="edit-form"
            disabled={loading || saving}
            className="px-6 py-2.5 rounded-lg font-bold bg-primary text-on-primary hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                Menyimpan...
              </>
            ) : (
              'Simpan Perubahan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

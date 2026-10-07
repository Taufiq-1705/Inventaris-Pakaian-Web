import React, { useState, useEffect, type FormEvent } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { api, type CategoryData, type WarehouseStats } from '../lib/api';

const TambahBarangPage: React.FC = () => {
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [typeId, setTypeId] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');

  // Data from API
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseStats[]>([]);

  // Fetch categories and warehouses on mount
  useEffect(() => {
    api<{ categories: CategoryData[] }>('/api/categories')
      .then(data => setCategories(data.categories))
      .catch(console.error);

    api<{ warehouses: WarehouseStats[] }>('/api/warehouses')
      .then(data => setWarehouses(data.warehouses))
      .catch(console.error);
  }, []);

  // Get current category and its types
  const currentCategory = categories.find(c => c.slug === categorySlug);
  const currentTypes = currentCategory?.types || [];

  // Get current category ID
  const currentCategoryId = currentCategory?.id;

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextSlug = e.target.value;
    setCategorySlug(nextSlug);
    setTypeId('');
    if (nextSlug === 'top') {
      setWarehouseId('1');
    } else if (nextSlug === 'bottom') {
      setWarehouseId('2');
    } else {
      setWarehouseId('');
    }
  };

  const incrementQty = () => setQuantity(prev => prev + 1);
  const decrementQty = () => setQuantity(prev => prev > 0 ? prev - 1 : 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!productCode.trim() || !productName.trim() || !categorySlug || !typeId || !size || !warehouseId) {
      setError('Semua kolom wajib diisi (Kode Barang, Nama Barang, Kategori, Tipe, Ukuran, dan Gudang)');
      return;
    }

    setIsSaving(true);
    
    try {
      await api('/api/items', {
        method: 'POST',
        body: JSON.stringify({
          code: productCode,
          name: productName,
          categoryId: currentCategoryId,
          itemTypeId: parseInt(typeId),
          size,
          quantity,
          warehouseId: parseInt(warehouseId),
          notes: notes || undefined,
        }),
      });

      setIsSaving(false);
      setIsSaved(true);
      
      setTimeout(() => {
        setIsSaved(false);
        handleReset();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan barang');
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setProductCode('');
    setProductName('');
    setCategorySlug('');
    setTypeId('');
    setSize('');
    setQuantity(0);
    setWarehouseId('');
    setNotes('');
    setError('');
  };

  // Get selected warehouse data for display
  const selectedWarehouse = warehouses.find(w => String(w.id) === warehouseId);

  // Get capacity color
  const getCapColor = (pct: number) => {
    if (pct >= 90) return 'error';
    if (pct >= 70) return 'tertiary';
    return 'secondary';
  };

  return (
    <div className="bg-background text-on-background antialiased min-h-screen">
      <Sidebar />
      <Header />
      
      {/* Main Content */}
      <main className="ml-[260px] pt-24 min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="mb-8 flex flex-col gap-2">
            <h2 className="font-display-lg text-display-lg text-on-surface">Tambah Barang Baru</h2>
            <p className="text-on-surface-variant font-body-md">Input detail barang garment baru untuk didaftarkan ke sistem inventaris.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 bg-error/10 text-error px-4 py-3 rounded-lg border border-error/20 font-medium">
              {error}
            </div>
          )}

          {/* Form Card */}
          <div className="bg-surface-container-low rounded-xl shadow-lg border border-outline-variant overflow-hidden">
            <div className="p-8 border-b border-outline-variant bg-surface-container-lowest">
              <div className="flex items-center gap-2 text-primary font-bold">
                <span className="material-symbols-outlined">inventory_2</span>
                <span className="uppercase tracking-widest text-xs">Informasi Produk</span>
              </div>
            </div>
            
            <form className="p-8 space-y-8" onSubmit={handleSubmit} onReset={handleReset}>
              {/* Row 1: Code & Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Kode Barang</label>
                  <input 
                    className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none" 
                    placeholder="Contoh: GRM-TS-001" 
                    type="text"
                    value={productCode}
                    onChange={e => setProductCode(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Nama Barang</label>
                  <input 
                    className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none" 
                    placeholder="Contoh: Oversized Basic Tee" 
                    type="text"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Category & Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Kategori</label>
                  <select 
                    className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none appearance-none" 
                    value={categorySlug}
                    onChange={handleCategoryChange}
                  >
                    <option disabled value="">Pilih Kategori</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Tipe</label>
                  <select 
                    className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none appearance-none" 
                    value={typeId}
                    onChange={e => setTypeId(e.target.value)}
                    disabled={!categorySlug}
                  >
                    <option disabled value="">Pilih Kategori Terlebih Dahulu</option>
                    {currentTypes.map(t => (
                      <option key={t.id} value={String(t.id)}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Size & Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Ukuran</label>
                  <div className="flex gap-2">
                    {['S', 'M', 'L', 'XL', 'XXL'].map(s => (
                      <button 
                        key={s}
                        type="button"
                        className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${size === s ? 'bg-primary text-on-primary-container border-primary' : 'border-outline-variant hover:border-primary'}`}
                        onClick={() => setSize(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Jumlah</label>
                  <div className="flex items-center">
                    <button 
                      className="bg-surface-container-highest border border-outline-variant p-3 rounded-l-lg hover:bg-surface-variant transition-all active:scale-90" 
                      onClick={decrementQty} 
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">remove</span>
                    </button>
                    <input 
                      className="w-full bg-surface-container-lowest border-y border-x-0 border-outline-variant p-3 text-center text-on-surface focus:ring-0 outline-none font-mono-data" 
                      type="number" 
                      value={quantity}
                      onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                    />
                    <button 
                      className="bg-surface-container-highest border border-outline-variant p-3 rounded-r-lg hover:bg-surface-variant transition-all active:scale-90" 
                      onClick={incrementQty} 
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 4: Warehouse Selection — Dynamic from API */}
              <div className="flex flex-col gap-4">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Pilih Gudang Penyimpanan</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {warehouses.map(w => {
                    const capColor = getCapColor(w.percentage);
                    const isAllowed = categorySlug ? (!w.allowedCategoryId || w.allowedCategoryId === currentCategoryId) : false;
                    return (
                      <label key={w.id} className={`relative group ${isAllowed ? 'cursor-pointer' : 'opacity-40 pointer-events-none cursor-not-allowed'}`}>
                        <input 
                          className="hidden peer" 
                          name="warehouse" 
                          type="radio" 
                          value={String(w.id)}
                          checked={warehouseId === String(w.id)}
                          onChange={() => {
                            if (isAllowed) setWarehouseId(String(w.id));
                          }}
                          disabled={!isAllowed}
                        />
                        <div className="p-4 bg-surface-container-lowest border border-outline-variant rounded-xl peer-checked:border-primary peer-checked:bg-primary-container/10 transition-all">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm">{w.name}</span>
                            <span className={`text-[10px] bg-${capColor}-container/20 text-${capColor} px-2 py-0.5 rounded-full font-bold`}>
                              {Math.round(w.percentage)}% Terisi
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-outline-variant rounded-full overflow-hidden">
                            <div className={`bg-${capColor} h-full rounded-full`} style={{ width: `${w.percentage}%` }}></div>
                          </div>
                          <p className="text-[10px] text-on-surface-variant mt-2">{w.description || ''}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Row 5: Notes */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider ml-1">Keterangan Tambahan</label>
                <textarea 
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none resize-none" 
                  placeholder="Tambahkan catatan khusus seperti batch produksi, vendor kain, atau intruksi khusus..." 
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                ></textarea>
              </div>

              {/* Buttons Row */}
              <div className="flex items-center justify-between pt-6 border-t border-outline-variant">
                <button 
                  className="px-6 py-3 border border-outline-variant text-on-surface-variant rounded-lg font-bold hover:bg-surface-container-high hover:text-on-surface transition-all flex items-center gap-2 active:scale-95" 
                  type="reset"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  <span>Reset Form</span>
                </button>
                <div className="flex gap-4">
                  <button className="px-6 py-3 bg-surface-variant text-on-surface rounded-lg font-bold hover:bg-outline-variant transition-all flex items-center gap-2 active:scale-95" type="button">
                    <span>Batal</span>
                  </button>
                  <button 
                    className={`px-8 py-3 rounded-lg font-bold transition-all flex items-center gap-2 ${isSaved ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary-container shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95'}`}
                    type="submit"
                    disabled={isSaving || isSaved}
                  >
                    {isSaving ? (
                      <>
                        <span className="material-symbols-outlined animate-spin" style={{ fontVariationSettings: "'FILL' 1" }}>sync</span>
                        <span>Menyimpan...</span>
                      </>
                    ) : isSaved ? (
                      <>
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        <span>Tersimpan!</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
                        <span>Simpan Barang</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Summary Bar */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 opacity-75">
            <div className="bg-surface-container rounded-lg p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">qr_code_2</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">SKU Baru</p>
                <p className="text-sm font-mono-data">{productCode || 'GRM-XXXX-000'}</p>
              </div>
            </div>
            
            <div className="bg-surface-container rounded-lg p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">straighten</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Ukuran Terpilih</p>
                <p className="text-sm font-mono-data">{size || '-'}</p>
              </div>
            </div>
            
            <div className="bg-surface-container rounded-lg p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded bg-tertiary/10 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined">inventory</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">Target Lokasi</p>
                <p className="text-sm font-mono-data">{selectedWarehouse?.name || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TambahBarangPage;

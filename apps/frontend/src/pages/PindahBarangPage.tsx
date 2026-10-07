import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { api, type ItemData, type WarehouseStats, type TransferData } from '../lib/api';

const PindahBarangPage: React.FC = () => {
  // API data
  const [itemsList, setItemsList] = useState<ItemData[]>([]);
  const [warehousesList, setWarehousesList] = useState<WarehouseStats[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<TransferData[]>([]);

  // Form state
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedDestId, setSelectedDestId] = useState('');
  const [transferQty, setTransferQty] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch data on mount
  useEffect(() => {
    api<{ items: ItemData[]; pagination: any }>('/api/items?limit=100')
      .then(data => setItemsList(data.items))
      .catch(console.error);

    api<{ warehouses: WarehouseStats[] }>('/api/warehouses')
      .then(data => setWarehousesList(data.warehouses))
      .catch(console.error);

    api<{ transfers: TransferData[] }>('/api/transfers?limit=5')
      .then(data => setRecentTransfers(data.transfers))
      .catch(console.error);
  }, []);

  // Derived values
  const currentItem = itemsList.find(i => String(i.id) === selectedItemId);
  const maxAvailable = currentItem?.quantity ?? 0;

  const currentDest = warehousesList.find(w => String(w.id) === selectedDestId);
  const totalCap = currentDest?.maxCapacity ?? 0;
  const currentUsed = currentDest?.currentStock ?? 0;
  const qtyInput = typeof transferQty === 'number' ? transferQty : 0;

  const projectedUsed = currentUsed + qtyInput;
  const percentage = totalCap > 0 ? Math.min((projectedUsed / totalCap) * 100, 100) : 0;

  // When an item is selected, auto-set the source warehouse
  useEffect(() => {
    if (currentItem) {
      setSelectedSourceId(String(currentItem.warehouseId));
    }
  }, [currentItem]);

  // Auto-select first compatible destination that isn't source
  useEffect(() => {
    if (warehousesList.length > 0 && currentItem) {
      const isDestValid = (destId: string) => {
        const dest = warehousesList.find(w => String(w.id) === destId);
        return dest && String(dest.id) !== selectedSourceId && (!dest.allowedCategoryId || dest.allowedCategoryId === currentItem.categoryId);
      };
      
      if (!selectedDestId || !isDestValid(selectedDestId)) {
        const firstValidDest = warehousesList.find(w => 
          String(w.id) !== selectedSourceId && 
          (!w.allowedCategoryId || w.allowedCategoryId === currentItem.categoryId)
        );
        if (firstValidDest) {
          setSelectedDestId(String(firstValidDest.id));
        } else {
          setSelectedDestId('');
        }
      }
    }
  }, [warehousesList, selectedSourceId, currentItem, selectedDestId]);

  let capacityBarClass = 'h-full transition-all duration-500 ease-out ';
  let remainingCapClass = 'text-2xl font-mono-data ';

  if (percentage > 95) {
    capacityBarClass += 'bg-error';
    remainingCapClass += 'text-error';
  } else if (percentage > 75) {
    capacityBarClass += 'bg-tertiary';
    remainingCapClass += 'text-tertiary';
  } else {
    capacityBarClass += 'bg-secondary';
    remainingCapClass += 'text-secondary';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!qtyInput || qtyInput <= 0) {
      setError('Silakan masukkan jumlah barang yang valid.');
      return;
    }

    if (qtyInput > maxAvailable) {
      setError('Stok barang tidak mencukupi di gudang asal.');
      return;
    }

    setSubmitting(true);
    try {
      await api('/api/transfers', {
        method: 'POST',
        body: JSON.stringify({
          itemId: parseInt(selectedItemId),
          sourceWarehouseId: parseInt(selectedSourceId),
          destWarehouseId: parseInt(selectedDestId),
          quantity: qtyInput,
        }),
      });

      setSuccessMsg('Transfer berhasil diproses!');
      setTransferQty('');
      setSelectedItemId('');

      // Refresh data
      const [itemsData, warehousesData, transfersData] = await Promise.all([
        api<{ items: ItemData[]; pagination: any }>('/api/items?limit=100'),
        api<{ warehouses: WarehouseStats[] }>('/api/warehouses'),
        api<{ transfers: TransferData[] }>('/api/transfers?limit=5'),
      ]);
      setItemsList(itemsData.items);
      setWarehousesList(warehousesData.warehouses);
      setRecentTransfers(transfersData.transfers);

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Gagal memproses perpindahan');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <Sidebar />
      <Header />
      
      {/* Main Content */}
      <main className="ml-[260px] pt-24 p-container-padding h-screen overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-12 gap-card-gap max-w-7xl mx-auto">
          
          {/* Page Header */}
          <div className="col-span-12 mb-4">
            <h2 className="font-display-lg text-display-lg text-primary">Pindah Barang Antar Gudang</h2>
            <p className="text-on-surface-variant font-body-md text-body-md">Lakukan logistik internal secara presisi dan terpantau.</p>
          </div>

          {/* Messages */}
          {error && (
            <div className="col-span-12 bg-error/10 text-error px-4 py-3 rounded-lg border border-error/20 font-medium">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="col-span-12 bg-secondary/10 text-secondary px-4 py-3 rounded-lg border border-secondary/20 font-medium">
              {successMsg}
            </div>
          )}

          {/* Form Section */}
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-surface-container p-6 rounded-xl shadow-md border border-outline-variant">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Select Item */}
                  <div className="col-span-2">
                    <label className="block text-on-surface-variant font-label-caps text-label-caps mb-2">PILIH BARANG</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none cursor-pointer"
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                      >
                        <option value="" disabled>Pilih SKU / Nama Barang</option>
                         {itemsList.map(item => (
                          <option key={item.id} value={String(item.id)}>
                            {item.name} — {item.code} ({item.quantity} pcs) — {item.warehouseName}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                    </div>
                  </div>

                  {/* Source Warehouse */}
                  <div>
                    <label className="block text-on-surface-variant font-label-caps text-label-caps mb-2">GUDANG ASAL</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:border-primary outline-none appearance-none cursor-pointer"
                        value={selectedSourceId}
                        onChange={(e) => setSelectedSourceId(e.target.value)}
                      >
                        {warehousesList.map(w => (
                          <option key={w.id} value={String(w.id)}>{w.name} — {w.description}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">warehouse</span>
                    </div>
                  </div>

                  {/* Destination Warehouse */}
                  <div>
                    <label className="block text-on-surface-variant font-label-caps text-label-caps mb-2">GUDANG TUJUAN</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:border-primary outline-none appearance-none cursor-pointer"
                        value={selectedDestId}
                        onChange={(e) => setSelectedDestId(e.target.value)}
                      >
                        {warehousesList
                          .filter(w => String(w.id) !== selectedSourceId)
                          .filter(w => !w.allowedCategoryId || w.allowedCategoryId === currentItem?.categoryId)
                          .map(w => (
                            <option key={w.id} value={String(w.id)}>
                              {w.name} (Kapasitas: {w.maxCapacity.toLocaleString()})
                            </option>
                          ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">location_on</span>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2">
                    <label className="block text-on-surface-variant font-label-caps text-label-caps mb-2">JUMLAH BARANG (PCS)</label>
                    <div className="flex items-center gap-4">
                      <input 
                        className="flex-1 bg-surface-container-highest border border-outline-variant rounded-lg px-4 py-3 text-on-surface focus:border-primary outline-none transition-all text-xl font-mono-data" 
                        placeholder="0" 
                        type="number"
                        value={transferQty}
                        onChange={(e) => setTransferQty(e.target.value ? parseInt(e.target.value) : '')}
                      />
                      <div className="flex flex-col text-on-surface-variant">
                        <span className="font-label-caps text-[10px]">MAX AVAILABLE:</span>
                        <span className="font-mono-data text-primary">{maxAvailable} pcs</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-4">
                  <button 
                    className="w-full bg-primary text-on-primary font-bold py-4 rounded-lg flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50" 
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">sync</span>
                        MEMPROSES...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">swap_horiz</span>
                        PROSES PERPINDAHAN
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Visualization Section */}
          <div className="col-span-12 lg:col-span-5">
            <div className="space-y-6">
              
              {/* Target Capacity Card */}
              <div className="bg-surface-container-high p-6 rounded-xl shadow-md border border-outline-variant">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-on-surface-variant font-label-caps text-label-caps">STATUS GUDANG TUJUAN</p>
                    <h3 className="text-on-surface font-headline-md text-headline-md">{currentDest?.name || 'Pilih gudang'}</h3>
                  </div>
                  <span className="material-symbols-outlined text-primary text-4xl">analytics</span>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-body-sm text-on-surface-variant">Okupansi Saat Ini</span>
                      <span className="text-body-sm font-bold text-on-surface">{Math.round(percentage)}%</span>
                    </div>
                    <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className={capacityBarClass} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface p-4 rounded-lg border border-outline-variant">
                      <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Total Kapasitas</p>
                      <p className="text-2xl font-mono-data text-on-surface">{totalCap.toLocaleString()}</p>
                    </div>
                    <div className="bg-surface p-4 rounded-lg border border-outline-variant">
                      <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Sisa Kapasitas</p>
                      <p className={remainingCapClass}>{(totalCap - projectedUsed).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>



            </div>
          </div>

          {/* Recent History — Now from API */}
          <div className="col-span-12 mt-8">
            <div className="bg-surface-container p-6 rounded-xl border border-outline-variant">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-on-surface font-title-sm text-title-sm">Perpindahan Terakhir</h3>
                <a className="text-primary text-body-sm hover:underline" href="#">Lihat Semua History</a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-on-surface-variant font-label-caps text-label-caps border-b border-outline-variant">
                    <tr>
                      <th className="pb-3 px-2">WAKTU</th>
                      <th className="pb-3 px-2">BARANG</th>
                      <th className="pb-3 px-2">DARI</th>
                      <th className="pb-3 px-2">KE</th>
                      <th className="pb-3 px-2">JUMLAH</th>
                      <th className="pb-3 px-2">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-sm divide-y divide-outline-variant">
                    {recentTransfers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-on-surface-variant">Belum ada riwayat transfer</td>
                      </tr>
                    ) : (
                      recentTransfers.map(t => (
                        <tr key={t.id} className="hover:bg-surface-variant transition-colors">
                          <td className="py-4 px-2 font-mono-data">{formatTime(t.createdAt)}</td>
                          <td className="py-4 px-2">{t.item?.name ?? 'Unknown'}</td>
                          <td className="py-4 px-2">{t.sourceWarehouse?.name ?? '-'}</td>
                          <td className="py-4 px-2">{t.destWarehouse?.name ?? '-'}</td>
                          <td className="py-4 px-2">{t.quantity} pcs</td>
                          <td className="py-4 px-2">
                            <span className={`px-3 py-1 ${t.status === 'SUKSES' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-error/10 text-error border-error/20'} border rounded-full text-[10px] font-bold`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default PindahBarangPage;

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { AlertModal } from '../components/AlertModal';
import { api, type ItemData, type OutgoingHistoryEntry, type OutgoingHistoryResponse, type WarehouseStats } from '../lib/api';

interface LocalItem {
  id: string; // itemId as string
  code: string;
  name: string;
  quantity: number;
  unit: string;
  maxStock: number;
}

export const KeluarBarangPage: React.FC = () => {
  // Form states
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [trxId, setTrxId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  
  // Dynamic items and warehouses list from API
  const [availableItems, setAvailableItems] = useState<ItemData[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseStats[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [dispatchItems, setDispatchItems] = useState<LocalItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // History and pagination states
  const [history, setHistory] = useState<OutgoingHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

  // History query filter states
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterType, setFilterType] = useState('Semua');
  const [filterSearch, setFilterSearch] = useState('');

  // Active query parameters used for API call
  const [queryDateFrom, setQueryDateFrom] = useState('');
  const [queryDateTo, setQueryDateTo] = useState('');
  const [queryType, setQueryType] = useState('Semua');
  const [querySearch, setQuerySearch] = useState('');

  const [savingTx, setSavingTx] = useState(false);

  // Alert modal states
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertVariant, setAlertVariant] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  const showAlert = (title: string, message: string, variant: 'success' | 'error' | 'warning' | 'info') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVariant(variant);
    setAlertOpen(true);
  };

  // Fetch next transaction code
  const fetchNextCode = useCallback(async () => {
    try {
      const res = await api<{ code: string }>('/api/outgoing/next-code');
      setTrxId(res.code);
    } catch (err) {
      console.error('Failed to fetch transaction code:', err);
    }
  }, []);

  // Fetch items for form select dropdown
  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const res = await api<{ items: ItemData[] }>('/api/items?limit=1000');
      setAvailableItems(res.items || []);
    } catch (err) {
      console.error('Failed to fetch items list:', err);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  // Fetch history list
  const fetchHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '10');
      if (queryDateFrom) params.set('dateFrom', queryDateFrom);
      if (queryDateTo) params.set('dateTo', queryDateTo);
      if (queryType && queryType !== 'Semua') params.set('type', queryType);
      if (querySearch) params.set('search', querySearch);

      const res = await api<OutgoingHistoryResponse>(`/api/outgoing/history?${params.toString()}`);
      setHistory(res.history || []);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [queryDateFrom, queryDateTo, queryType, querySearch]);

  // Load initial data
  useEffect(() => {
    fetchNextCode();
    fetchItems();
    api<{ warehouses: WarehouseStats[] }>('/api/warehouses')
      .then(data => setWarehouses(data.warehouses))
      .catch(console.error);
  }, [fetchNextCode, fetchItems]);

  // Sync history when active query params change
  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    if (warehouseId && selectedItemId) {
      const selectedItem = availableItems.find(i => String(i.id) === selectedItemId);
      if (selectedItem && String(selectedItem.warehouseId) !== warehouseId) {
        setSelectedItemId('');
        setQuantity('');
      }
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !quantity || quantity <= 0) {
      showAlert('Input Tidak Valid', 'Pilih barang dan jumlah yang valid.', 'warning');
      return;
    }

    const itemTemplate = availableItems.find(i => String(i.id) === selectedItemId);
    if (!itemTemplate) return;

    // Check if stock is sufficient
    if (itemTemplate.quantity < quantity) {
      showAlert('Stok Tidak Cukup', `Stok tidak mencukupi. Tersedia: ${itemTemplate.quantity} Pcs.`, 'error');
      return;
    }

    // Check if already in the local dispatch list
    if (dispatchItems.some(i => i.id === selectedItemId)) {
      showAlert('Barang Sudah Ada', 'Barang ini sudah ada dalam daftar pengeluaran.', 'warning');
      return;
    }

    setDispatchItems(prev => [
      ...prev,
      {
        id: String(itemTemplate.id),
        code: itemTemplate.code,
        name: itemTemplate.name,
        quantity: Number(quantity),
        unit: 'Pcs',
        maxStock: itemTemplate.quantity,
      },
    ]);

    setSelectedItemId('');
    setQuantity('');
  };

  const handleRemoveItem = (id: string) => {
    setDispatchItems(prev => prev.filter(i => i.id !== id));
  };

  const handleClearForm = () => {
    setSelectedItemId('');
    setQuantity('');
    setSelectedWarehouseId('');
    setDispatchItems([]);
  };

  const handleSaveTransaction = async () => {
    if (dispatchItems.length === 0) {
      showAlert('Daftar Kosong', 'Daftar barang pengeluaran masih kosong.', 'warning');
      return;
    }

    setSavingTx(true);
    try {
      await api('/api/outgoing', {
        method: 'POST',
        body: JSON.stringify({
          date,
          items: dispatchItems.map(i => ({
            itemId: parseInt(i.id),
            quantity: i.quantity,
          })),
        }),
      });

      showAlert('Transaksi Disimpan', 'Transaksi pengeluaran berhasil disimpan!', 'success');
      handleClearForm();
      fetchNextCode();
      fetchItems();
      fetchHistory(1);
    } catch (err: any) {
      showAlert('Transaksi Gagal', err.message || 'Gagal menyimpan transaksi', 'error');
    } finally {
      setSavingTx(false);
    }
  };

  const handleApplyFilter = () => {
    setQueryDateFrom(filterDateFrom);
    setQueryDateTo(filterDateTo);
    setQueryType(filterType);
    setQuerySearch(filterSearch);
  };

  const handleResetFilter = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterType('Semua');
    setFilterSearch('');

    setQueryDateFrom('');
    setQueryDateTo('');
    setQueryType('Semua');
    setQuerySearch('');
  };

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    const { page, totalPages } = pagination;
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const filteredItemsForSelect = selectedWarehouseId
    ? availableItems.filter(item => String(item.warehouseId) === selectedWarehouseId)
    : availableItems;

  return (
    <div className="dark min-h-screen bg-background text-on-surface animate-fadeIn">
      <Sidebar />
      <Header />

      <main className="ml-[260px] pt-24 px-container-padding pb-gutter min-h-screen flex flex-col gap-card-gap">
        {/* Page Header */}
        <div>
          <h2 className="font-display-lg text-display-lg text-on-surface">Keluar Barang</h2>
          <nav className="flex text-on-surface-variant text-body-sm mt-1">
            <span>Gudang</span>
            <span className="mx-2">/</span>
            <span>Transaksi</span>
            <span className="mx-2">/</span>
            <span className="text-primary font-medium">Keluar Barang</span>
          </nav>
        </div>

        {/* Form Card */}
        <section className="bg-surface-container border border-outline-variant rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-high/50">
            <h3 className="font-title-sm text-title-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">add_circle</span>
              Form Keluar Barang
            </h3>
          </div>
          <div className="p-6">
            {/* Input Row Form */}
            <form onSubmit={handleAddItem} className="space-y-6">
              {/* Row 1: General Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">TANGGAL</label>
                  <input
                    className="w-full bg-background border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm focus:border-primary outline-none"
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">NO. TRANSAKSI</label>
                  <input
                    className="w-full bg-surface-container-highest border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm focus:border-primary outline-none text-on-surface-variant opacity-70 cursor-not-allowed"
                    type="text"
                    value={trxId}
                    disabled
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">PILIH GUDANG</label>
                  <div className="relative">
                    <select
                      className="w-full bg-background border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm focus:border-primary outline-none appearance-none cursor-pointer"
                      value={selectedWarehouseId}
                      onChange={e => handleWarehouseChange(e.target.value)}
                    >
                      <option value="">Semua Gudang</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={String(w.id)}>{w.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Add Item Row */}
              <div className="border-t border-outline-variant/30 pt-4 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">NAMA BARANG</label>
                  <div className="relative">
                    <select
                      className="w-full bg-background border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm focus:border-primary outline-none appearance-none cursor-pointer"
                      value={selectedItemId}
                      onChange={e => setSelectedItemId(e.target.value)}
                      disabled={loadingItems}
                    >
                      <option value="" disabled>
                        {loadingItems ? 'Memuat barang...' : 'Pilih barang...'}
                      </option>
                      {filteredItemsForSelect.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} [{item.code}] - (Stok: {item.quantity} pcs) - {item.warehouseName}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
                  </div>
                </div>
                <div className="w-full md:w-48 space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">JUMLAH</label>
                  <input
                    className="w-full bg-background border border-outline-variant rounded-lg px-4 py-2.5 text-body-sm focus:border-primary outline-none"
                    placeholder="0"
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value ? parseInt(e.target.value) : '')}
                  />
                </div>
                <button
                  type="submit"
                  className="bg-primary text-on-primary font-bold px-6 py-2.5 rounded-lg flex items-center gap-2 active:scale-95 hover:opacity-90 transition-all h-[46px] mt-auto w-full md:w-auto justify-center"
                >
                  <span className="material-symbols-outlined">add</span>
                  Tambah ke Daftar
                </button>
              </div>
            </form>

            {/* Items Table */}
            <div className="mt-8 overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-highest">
                  <tr>
                    <th className="px-6 py-3 font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant">NO</th>
                    <th className="px-6 py-3 font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant">KODE BARANG</th>
                    <th className="px-6 py-3 font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant">NAMA BARANG</th>
                    <th className="px-6 py-3 font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant">JUMLAH</th>
                    <th className="px-6 py-3 font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant">SATUAN</th>
                    <th className="px-6 py-3 font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {dispatchItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-on-surface-variant">
                        Belum ada barang yang ditambahkan ke daftar pengeluaran.
                      </td>
                    </tr>
                  ) : (
                    dispatchItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-surface-container-high transition-colors">
                        <td className="px-6 py-4 font-mono-data text-mono-data">{idx + 1}</td>
                        <td className="px-6 py-4 font-mono-data text-mono-data text-primary">{item.code}</td>
                        <td className="px-6 py-4 font-body-md text-body-md">{item.name}</td>
                        <td className="px-6 py-4 font-mono-data text-mono-data">{item.quantity}</td>
                        <td className="px-6 py-4 text-on-surface-variant">{item.unit}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-error hover:bg-error/10 p-1.5 rounded-full transition-colors"
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex justify-start gap-3">
              <button
                onClick={handleSaveTransaction}
                disabled={savingTx || dispatchItems.length === 0}
                className="bg-primary text-on-primary font-bold px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-primary/95 active:scale-95 transition-all shadow-lg shadow-primary/10 disabled:opacity-50"
              >
                {savingTx ? 'Menyimpan...' : 'Simpan Transaksi'}
              </button>
              <button
                type="button"
                onClick={handleClearForm}
                className="bg-surface-container-highest text-on-surface font-bold px-8 py-3 rounded-lg flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all border border-outline-variant"
              >
                Kosongkan Form
              </button>
            </div>
          </div>
        </section>

        {/* History Section */}
        <section className="bg-surface-container border border-outline-variant rounded-xl shadow-lg p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h3 className="font-display-lg text-title-sm text-on-surface">
                Riwayat Keluar Masuk Barang
              </h3>
            </div>
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">DARI TANGGAL</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="bg-background border border-outline-variant rounded-lg px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary w-40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">SAMPAI TANGGAL</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="bg-background border border-outline-variant rounded-lg px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary w-40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">TIPE</label>
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="bg-background border border-outline-variant rounded-lg pl-3 pr-8 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary appearance-none w-32 cursor-pointer"
                  >
                    <option value="Semua">Semua</option>
                    <option value="MASUK">MASUK</option>
                    <option value="KELUAR">KELUAR</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[18px]">expand_more</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">CARI BARANG / TRX</label>
                <input
                  type="text"
                  placeholder="Kode, nama, TRX..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="bg-background border border-outline-variant rounded-lg px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:border-primary w-48"
                />
              </div>
              <div className="flex gap-2 self-end h-[38px] mt-auto">
                <button
                  onClick={handleApplyFilter}
                  className="bg-primary text-on-primary font-bold px-4 rounded-lg flex items-center gap-2 hover:opacity-90 transition-all text-body-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  Filter
                </button>
                <button
                  onClick={handleResetFilter}
                  className="bg-surface-container-highest text-on-surface font-bold px-4 rounded-lg flex items-center justify-center hover:brightness-110 transition-all border border-outline-variant text-body-sm"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-outline-variant">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-6 py-3.5 font-label-caps text-label-caps text-on-surface-variant">TANGGAL</th>
                  <th className="px-6 py-3.5 font-label-caps text-label-caps text-on-surface-variant">NO. TRANSAKSI</th>
                  <th className="px-6 py-3.5 font-label-caps text-label-caps text-on-surface-variant">KETERANGAN</th>
                  <th className="px-6 py-3.5 font-label-caps text-label-caps text-on-surface-variant">NAMA BARANG</th>
                  <th className="px-6 py-3.5 font-label-caps text-label-caps text-on-surface-variant text-right">JUMLAH</th>
                  <th className="px-6 py-3.5 font-label-caps text-label-caps text-on-surface-variant">SATUAN</th>
                  <th className="px-6 py-3.5 font-label-caps text-label-caps text-on-surface-variant text-right">SISA STOK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {historyLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-on-surface-variant">
                      Tidak ada riwayat transaksi yang cocok.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container-high/50 transition-colors">
                      <td className="px-6 py-4 text-on-surface-variant font-mono-data text-body-sm">{formatDate(item.date)}</td>
                      <td className="px-6 py-4 font-mono-data text-primary font-bold text-body-sm">{item.transactionCode}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold text-label-caps ${
                          item.type === 'MASUK' 
                            ? 'bg-secondary/10 text-secondary border border-secondary/20' 
                            : 'bg-error/10 text-error border border-error/20'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-body-sm">
                        <div className="font-medium text-on-surface">{item.itemName}</div>
                        <div className="text-[11px] text-on-surface-variant font-mono-data">{item.itemCode}</div>
                      </td>
                      <td className={`px-6 py-4 font-mono-data text-right text-body-sm font-bold ${item.quantity < 0 ? 'text-error' : 'text-secondary'}`}>
                        {item.quantity > 0 ? `+${item.quantity}` : item.quantity}
                      </td>
                      <td className="px-6 py-4 text-body-sm text-on-surface-variant">{item.unit}</td>
                      <td className="px-6 py-4 font-mono-data text-right text-body-sm text-on-surface">{item.remainingStock}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!historyLoading && pagination.totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-body-sm text-on-surface-variant">
              <div>
                Menampilkan <span className="font-bold text-on-surface">{(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)}</span> dari <span className="font-bold text-on-surface">{pagination.total}</span> data
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchHistory(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-variant text-on-surface disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                </button>
                {getPageNumbers().map((p, idx) => (
                  <button
                    key={idx}
                    disabled={p === '...'}
                    onClick={() => typeof p === 'number' && fetchHistory(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-body-sm ${
                      pagination.page === p
                        ? 'bg-primary text-on-primary font-bold'
                        : p === '...'
                          ? 'text-on-surface-variant'
                          : 'hover:bg-surface-variant text-on-surface'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => fetchHistory(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant hover:bg-surface-variant text-on-surface disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-auto py-6 text-center text-on-surface-variant opacity-40 border-t border-outline-variant/30">
          <p className="font-body-sm text-body-sm">GarmentFlow v2.1.0 © 2024 Warehouse Management System</p>
        </footer>
      </main>

      {/* Reusable Alert Modal */}
      <AlertModal
        isOpen={alertOpen}
        title={alertTitle}
        message={alertMessage}
        variant={alertVariant}
        onClose={() => setAlertOpen(false)}
      />
    </div>
  );
};

export default KeluarBarangPage;

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { api, type ItemsResponse, type CategoryData, type WarehouseStats } from '../lib/api';
import { EditItemModal } from '../components/EditItemModal';
import { ConfirmModal } from '../components/ConfirmModal';

const MonitoringPage: React.FC = () => {
  const [urlParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(urlParams.get('search') || '');
  const [items, setItems] = useState<ItemsResponse['items']>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  // Filter state
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');

  // Options for dropdowns
  const [warehouses, setWarehouses] = useState<WarehouseStats[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);

  // Summary stats
  const [summaryStats, setSummaryStats] = useState({ total: 0, aman: 0, menipis: 0, kritis: 0 });

  // Fetch filter options on mount
  useEffect(() => {
    api<{ warehouses: WarehouseStats[] }>('/api/warehouses')
      .then(data => setWarehouses(data.warehouses))
      .catch(console.error);

    api<{ categories: CategoryData[] }>('/api/categories')
      .then(data => setCategories(data.categories))
      .catch(console.error);
  }, []);

  // Fetch items whenever filters/page change
  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '10');
      if (searchQuery) params.set('search', searchQuery);
      if (warehouseFilter) params.set('warehouse', warehouseFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (sizeFilter) params.set('size', sizeFilter);

      const data = await api<ItemsResponse>(`/api/items?${params.toString()}`);
      setItems(data.items);
      setPagination(data.pagination);

      // Compute summary stats from current results
      const aman = data.items.filter(i => i.status === 'AMAN').length;
      const menipis = data.items.filter(i => i.status === 'MENIPIS').length;
      const kritis = data.items.filter(i => i.status === 'KRITIS').length;
      setSummaryStats({
        total: data.pagination.total,
        aman,
        menipis,
        kritis,
      });
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, warehouseFilter, categoryFilter, typeFilter, sizeFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => fetchItems(1), 300);
    return () => clearTimeout(debounce);
  }, [fetchItems]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AMAN': return 'secondary';
      case 'MENIPIS': return 'tertiary';
      case 'KRITIS': return 'error';
      default: return 'secondary';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchItems(page);
    }
  };

  const handleDelete = (id: number, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/api/items/${deleteTarget.id}`, { method: 'DELETE' });
      fetchItems(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus barang');
    } finally {
      setDeleteTarget(null);
    }
  };

  // Generate page numbers for pagination
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

  const availableTypes = categoryFilter
    ? categories.find(c => c.slug === categoryFilter)?.types || []
    : categories.flatMap(c => c.types);

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <Sidebar />
      <Header />
      
      {/* Main Content */}
      <main className="ml-sidebar-width pt-24 p-container-padding">
        {/* Dashboard Filters - Bento-ish Grid */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Search Bar */}
            <div className="md:col-span-4 bg-surface-container rounded-xl p-4 shadow-sm">
              <label className="block text-label-caps text-on-surface-variant mb-2">CARI BARANG</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">search</span>
                <input 
                  className="w-full bg-background border border-outline-variant rounded-lg pl-10 pr-4 py-2 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" 
                  placeholder="Masukkan Kode atau Nama..." 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Filters */}
            <div className="md:col-span-8 bg-surface-container rounded-xl p-4 shadow-sm">
              <label className="block text-label-caps text-on-surface-variant mb-2">FILTER KATEGORI & LOKASI</label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <select 
                  className="bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-body-sm focus:ring-primary focus:border-primary"
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                >
                  <option value="">Semua Gudang</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={String(w.id)}>{w.name}</option>
                  ))}
                </select>
                <select 
                  className="bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-body-sm focus:ring-primary focus:border-primary"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setTypeFilter('');
                  }}
                >
                  <option value="">Semua Kategori</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
                <select 
                  className="bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-body-sm focus:ring-primary focus:border-primary"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">Semua Tipe</option>
                  {availableTypes.map(t => (
                    <option key={t.id} value={t.slug}>{t.name}</option>
                  ))}
                </select>
                <select 
                  className="bg-background border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-body-sm focus:ring-primary focus:border-primary"
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                >
                  <option value="">Semua Ukuran</option>
                  <option>S</option>
                  <option>M</option>
                  <option>L</option>
                  <option>XL</option>
                  <option>XXL</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Main Data Table */}
        <div className="bg-surface-container rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline-variant">
                  <th className="px-6 py-4 text-label-caps text-on-surface-variant whitespace-nowrap">Kode Barang</th>
                  <th className="px-6 py-4 text-label-caps text-on-surface-variant whitespace-nowrap">Nama Barang</th>
                  <th className="px-6 py-4 text-label-caps text-on-surface-variant whitespace-nowrap">Kategori</th>
                  <th className="px-6 py-4 text-label-caps text-on-surface-variant whitespace-nowrap">Tipe</th>
                  <th className="px-6 py-4 text-label-caps text-on-surface-variant whitespace-nowrap">Ukuran</th>
                  <th className="px-6 py-4 text-label-caps text-on-surface-variant whitespace-nowrap">Jumlah Stok</th>
                  <th className="px-6 py-4 text-label-caps text-on-surface-variant whitespace-nowrap">Gudang</th>
                  <th className="px-6 py-4 text-label-caps text-on-surface-variant whitespace-nowrap">Tanggal Masuk</th>
                  <th className="px-6 py-4 text-label-caps text-on-surface-variant whitespace-nowrap text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-on-surface-variant">
                      {searchQuery 
                        ? `Tidak ada data yang sesuai dengan pencarian "${searchQuery}"`
                        : 'Belum ada data barang'
                      }
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const color = getStatusColor(item.status);
                    return (
                      <tr key={item.id} className="hover:bg-primary/5 transition-colors group cursor-pointer">
                        <td className="px-6 py-4 font-mono-data text-primary">{item.code}</td>
                        <td className="px-6 py-4 font-bold">{item.name}</td>
                        <td className="px-6 py-4 text-body-sm">{item.categoryName || '-'}</td>
                        <td className="px-6 py-4 text-body-sm">{item.typeName || '-'}</td>
                        <td className="px-6 py-4 text-body-sm"><span className="bg-surface-variant px-2 py-1 rounded">{item.size}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-${color === 'secondary' ? 'on-surface' : color}`}>{item.quantity}</span>
                            <span className={`text-[10px] text-${color} bg-${color}/10 px-1.5 py-0.5 rounded-full`}>{item.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-body-sm">{item.warehouseName || '-'}</td>
                        <td className="px-6 py-4 text-body-sm text-on-surface-variant">{formatDate(item.entryDate)}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-1">
                            <button 
                              className="p-2 text-primary hover:bg-primary-container/20 rounded-lg transition-all" 
                              title="Edit Barang" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItemId(item.id);
                              }}
                            >
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                            <button 
                              className="p-2 text-error hover:bg-error/10 rounded-lg transition-all" 
                              title="Hapus Barang" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id, item.name);
                              }}
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-outline-variant bg-surface-container-high">
            <span className="text-body-sm text-on-surface-variant">
              Menampilkan {items.length} dari {pagination.total.toLocaleString()} barang
            </span>
            <div className="flex items-center gap-2">
              <button 
                className="px-3 py-1 bg-surface-variant text-on-surface-variant rounded-md hover:bg-primary/20 hover:text-primary transition-all text-body-sm disabled:opacity-50"
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
              >
                <span className="material-symbols-outlined text-sm align-middle">chevron_left</span>
              </button>
              {getPageNumbers().map((p, i) => (
                p === '...' ? (
                  <span key={`dots-${i}`} className="text-on-surface-variant">...</span>
                ) : (
                  <button 
                    key={p}
                    className={`px-3 py-1 rounded-md text-body-sm ${p === pagination.page ? 'bg-primary text-on-primary font-bold' : 'bg-surface-variant text-on-surface-variant hover:bg-primary/20 hover:text-primary transition-all'}`}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                )
              ))}
              <button 
                className="px-3 py-1 bg-surface-variant text-on-surface-variant rounded-md hover:bg-primary/20 hover:text-primary transition-all text-body-sm disabled:opacity-50"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
              >
                <span className="material-symbols-outlined text-sm align-middle">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats Area */}
        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-surface-container p-6 rounded-xl shadow-sm flex items-center gap-4 border-l-4 border-primary">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">inventory</span>
            </div>
            <div>
              <p className="text-label-caps text-on-surface-variant">TOTAL STOK</p>
              <h3 className="text-headline-md font-bold">{pagination.total.toLocaleString()} <span className="text-body-sm font-normal text-on-surface-variant">Item</span></h3>
            </div>
          </div>
          <div className="bg-surface-container p-6 rounded-xl shadow-sm flex items-center gap-4 border-l-4 border-secondary">
            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <div>
              <p className="text-label-caps text-on-surface-variant">ITEM AMAN</p>
              <h3 className="text-headline-md font-bold">{summaryStats.aman} <span className="text-body-sm font-normal text-on-surface-variant">SKU</span></h3>
            </div>
          </div>
          <div className="bg-surface-container p-6 rounded-xl shadow-sm flex items-center gap-4 border-l-4 border-tertiary">
            <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined">warning</span>
            </div>
            <div>
              <p className="text-label-caps text-on-surface-variant">STOK RENDAH</p>
              <h3 className="text-headline-md font-bold">{summaryStats.menipis} <span className="text-body-sm font-normal text-on-surface-variant">SKU</span></h3>
            </div>
          </div>
          <div className="bg-surface-container p-6 rounded-xl shadow-sm flex items-center gap-4 border-l-4 border-error">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error">
              <span className="material-symbols-outlined">error</span>
            </div>
            <div>
              <p className="text-label-caps text-on-surface-variant">KEHABISAN STOK</p>
              <h3 className="text-headline-md font-bold">{summaryStats.kritis} <span className="text-body-sm font-normal text-on-surface-variant">SKU</span></h3>
            </div>
          </div>
        </section>
      </main>

      {/* Edit Modal */}
      {editingItemId !== null && (
        <EditItemModal 
          itemId={editingItemId}
          categories={categories}
          warehouses={warehouses}
          onClose={() => setEditingItemId(null)}
          onSuccess={() => {
            setEditingItemId(null);
            fetchItems(pagination.page);
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Hapus Barang"
        message={`Apakah Anda yakin ingin menghapus barang "${deleteTarget?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default MonitoringPage;

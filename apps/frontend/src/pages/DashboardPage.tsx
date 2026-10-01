import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import WarehouseCard from '../components/WarehouseCard';
import ActivityChart from '../components/ActivityChart';
import ActivityTable from '../components/ActivityTable';
import { UpdateStockModal } from '../components/UpdateStockModal';
import { api, type DashboardStats } from '../lib/api';

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpdateStock, setShowUpdateStock] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStats = () => {
    api<DashboardStats>('/api/dashboard/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Color type for warehouse cards based on percentage
  const getColorType = (pct: number) => {
    if (pct >= 90) return 'error' as const;
    if (pct >= 80) return 'tertiary' as const;
    return 'secondary' as const;
  };

  const getStatusLabel = (pct: number) => {
    if (pct >= 95) return 'KAPASITAS KRITIS';
    if (pct >= 80) return 'ZONA PERINGATAN';
    return 'STABIL';
  };

  const warehouseIcons = ['apparel', 'checkroom', 'inventory'];

  return (
    <div className="dark min-h-screen bg-background text-on-surface">
      <Sidebar />
      <Header />
      
      <main className="ml-[260px] pt-24 px-container-padding pb-gutter min-h-screen">
        {/* Dashboard Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="font-display-lg text-display-lg text-on-surface">Dashboard Utama</h2>
            <p className="text-body-md text-on-surface-variant">Pemantauan real-time inventaris garment dan kapasitas gudang.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowUpdateStock(true)}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:opacity-90 flex items-center gap-2 transition-all"
            >
              <span className="material-symbols-outlined">add</span>
              <span className="font-label-caps text-label-caps">Perbarui Stok</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
          </div>
        ) : stats ? (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-card-gap mb-8">
              <StatCard 
                title="JENIS BARANG" 
                value={stats.totalItems.toLocaleString()} 
                subtitle={
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">trending_up</span>
                    <span>Total SKU</span>
                  </div>
                }
                icon="category" 
                colorType="primary" 
              />
              <StatCard 
                title="TOTAL STOK" 
                value={stats.totalStock.toLocaleString()} 
                subtitle="Pcs Total"
                icon="inventory" 
                colorType="secondary" 
              />
              {stats.warehouses.map((w, i) => (
                <StatCard 
                  key={w.id}
                  title={w.name.toUpperCase()} 
                  value={w.currentStock.toLocaleString()} 
                  subtitle={
                    w.percentage >= 90 
                      ? <span className="font-bold">{w.percentage}% - KRITIS</span>
                      : `${w.percentage}% Kapasitas`
                  }
                  icon="warehouse" 
                  colorType={getColorType(w.percentage)} 
                />
              ))}
            </div>

            {/* Warehouse Capacity Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-card-gap mb-8">
              {stats.warehouses.map((w, i) => (
                <WarehouseCard 
                  key={w.id}
                  title={w.name}
                  description={w.description || ''}
                  icon={warehouseIcons[i] || 'warehouse'}
                  currentValue={w.currentStock}
                  maxValue={w.maxCapacity}
                  percentage={Math.round(w.percentage)}
                  colorType={getColorType(w.percentage)}
                  statusLabel={getStatusLabel(w.percentage)}
                  locationLabel={w.locationLabel || ''}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-on-surface-variant py-12">Gagal memuat data dashboard</div>
        )}

        {/* Visualization & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-card-gap">
          <ActivityChart />
          <ActivityTable key={refreshKey} />
        </div>
      </main>



      {/* Update Stock Modal */}
      {showUpdateStock && (
        <UpdateStockModal
          onClose={() => setShowUpdateStock(false)}
          onSuccess={() => {
            setShowUpdateStock(false);
            fetchStats();
            setRefreshKey(k => k + 1);
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;

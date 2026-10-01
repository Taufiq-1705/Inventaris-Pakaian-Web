import React, { useState, useEffect } from 'react';
import { api, type ActivityEntry } from '../lib/api';

const ActivityTable: React.FC = () => {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ activities: ActivityEntry[] }>('/api/dashboard/recent-activity?limit=20')
      .then((data) => setActivities(data.activities))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'MASUK': return 'secondary';
      case 'KELUAR': return 'tertiary';
      case 'PINDAH': return 'primary';
      default: return 'secondary';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatQuantity = (type: string, qty: number) => {
    if (type === 'MASUK') return `+${qty}`;
    if (type === 'KELUAR') return `-${qty}`;
    return String(qty);
  };

  return (
    <div className="glass-card rounded-xl flex flex-col hover:-translate-y-[2px] transition-transform duration-200 ease-out">
      <div className="p-6 border-b border-outline-variant">
        <h3 className="font-title-sm text-title-sm text-on-surface">Aktivitas Terbaru</h3>
        <p className="text-body-sm text-on-surface-variant">Log transaksi perpindahan barang terakhir.</p>
      </div>
      <div className="overflow-y-auto max-h-[400px] flex-1 custom-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="text-on-surface-variant font-label-caps text-label-caps border-b border-outline-variant bg-surface-container">
              <th className="px-6 py-4">Item &amp; SKU</th>
              <th className="px-6 py-4">Tipe</th>
              <th className="px-6 py-4">Gudang</th>
              <th className="px-6 py-4">Jumlah</th>
              <th className="px-6 py-4">Waktu</th>
            </tr>
          </thead>
          <tbody className="text-body-sm">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant">
                  Belum ada aktivitas
                </td>
              </tr>
            ) : (
              activities.map((activity) => {
                const color = getTypeColor(activity.type);
                return (
                  <tr key={activity.id} className="border-b border-outline-variant/30 hover:bg-surface-variant transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold">{activity.itemName}</div>
                      <div className="text-[10px] text-on-surface-variant">SKU: {activity.itemCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded bg-${color}/10 text-${color} text-[11px] font-bold`}>
                        {activity.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">{activity.warehouseName}</td>
                    <td className="px-6 py-4 text-mono-data">{formatQuantity(activity.type, activity.quantity)}</td>
                    <td className="px-6 py-4 text-on-surface-variant text-[12px]">{formatTime(activity.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityTable;

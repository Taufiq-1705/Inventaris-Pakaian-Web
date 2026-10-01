import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ChartDataEntry {
  day: string;
  date: string;
  masuk: number;
  keluar: number;
}

const ActivityChart: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'week' | 'month'>('week');
  const [chartData, setChartData] = useState<ChartDataEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<{ data: ChartDataEntry[] }>(`/api/dashboard/activity-chart?timeframe=${timeframe}`)
      .then((res) => setChartData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeframe]);

  // ChartJS Data setup
  const data = {
    labels: chartData.map((d) => d.day),
    datasets: [
      {
        label: 'Barang Masuk',
        data: chartData.map((d) => d.masuk),
        backgroundColor: '#adc6ff', // primary color
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      },
      {
        label: 'Barang Keluar',
        data: chartData.map((d) => d.keluar),
        backgroundColor: '#ffb786', // tertiary color
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      },
    ],
  };

  // ChartJS Options setup matching mockup aesthetics
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // We render our own custom HTML legends at the bottom
      },
      tooltip: {
        backgroundColor: '#1d2027',
        titleColor: '#e1e2ec',
        titleFont: { family: 'Inter', weight: 'bold' },
        bodyColor: '#e1e2ec',
        bodyFont: { family: 'Inter' },
        borderColor: '#424754',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#8c909f',
          font: {
            family: 'Inter',
            size: 10,
            weight: 'bold',
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#8c909f',
          font: {
            family: 'Inter',
            size: 10,
          },
          precision: 0,
        },
      },
    },
  };

  return (
    <div className="glass-card p-6 rounded-xl hover:-translate-y-[2px] transition-transform duration-200 ease-out flex flex-col h-full min-h-[380px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-title-sm text-title-sm text-on-surface">Arus Barang</h3>
          <p className="text-body-sm text-on-surface-variant">
            Perbandingan Barang Masuk &amp; Keluar ({timeframe === 'week' ? '7 Hari Terakhir' : '6 Bulan Terakhir'})
          </p>
        </div>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as 'week' | 'month')}
          className="bg-surface-container-high border-none rounded-lg text-body-sm text-on-surface focus:ring-primary py-1.5 px-3 cursor-pointer outline-none"
        >
          <option value="week">Minggu Ini</option>
          <option value="month">Per Bulan</option>
        </select>
      </div>

      <div className="flex-1 relative min-h-[220px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
          </div>
        ) : (
          <Bar data={data} options={options} />
        )}
      </div>

      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-primary rounded-full"></div>
          <span className="text-body-sm text-on-surface-variant">Barang Masuk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-tertiary rounded-full"></div>
          <span className="text-body-sm text-on-surface-variant">Barang Keluar</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityChart;

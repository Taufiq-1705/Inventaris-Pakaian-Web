import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { authClient } from '../lib/auth-client';
import { api } from '../lib/api';

const PengaturanPage: React.FC = () => {
  const navigate = useNavigate();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleLogout = async () => {
    if (window.confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
      await authClient.signOut();
      navigate('/login');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Semua kolom password wajib diisi');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password baru minimal 8 karakter');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
      });

      if (error) {
        setPasswordError(error.message || 'Gagal mengubah password');
        setChangingPassword(false);
        return;
      }

      setPasswordMsg('Password berhasil diubah!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(''), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal mengubah password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('PERINGATAN: Semua data akan dihapus secara permanen. Apakah Anda yakin?')) {
      try {
        await api('/api/profile', { method: 'DELETE' });
        await authClient.signOut();
        navigate('/login');
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus akun');
      }
    }
  };

  return (
    <div className="dark bg-background text-on-background min-h-screen">
      <Sidebar />
      <Header />
      
      {/* Main Content Area */}
      <main className="ml-[260px] min-h-screen p-container-padding pt-24">
        {/* Header Section */}
        <div className="mb-10">
          <p className="text-primary text-xs font-bold tracking-widest uppercase mb-1">Profil</p>
          <h2 className="text-4xl font-extrabold mb-2 tracking-tight text-on-surface">PENGATURAN</h2>
          <p className="text-on-surface-variant max-w-2xl text-sm">Kelola keamanan akun, notifikasi, dan preferensi Anda untuk pengalaman inventaris yang lebih baik.</p>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* CARD 1: Ubah Password */}
          <div className="col-span-12 lg:col-span-7 bg-surface-container-low border border-outline-variant rounded-2xl p-8">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-surface-container-highest border border-outline-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant">lock_open</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Ubah Password</h3>
                <p className="text-sm text-on-surface-variant">Perbarui password akun Anda secara berkala untuk keamanan.</p>
              </div>
            </div>
            <form className="space-y-6" onSubmit={handlePasswordChange}>
              {passwordError && (
                <div className="bg-error/10 text-error px-4 py-2 rounded-lg text-sm border border-error/20">{passwordError}</div>
              )}
              {passwordMsg && (
                <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg text-sm border border-secondary/20">{passwordMsg}</div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Password Lama</label>
                <input 
                  className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-on-surface-variant/50 transition-all outline-none" 
                  placeholder="Masukkan password lama" 
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Password Baru</label>
                <input 
                  className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-on-surface-variant/50 transition-all outline-none" 
                  placeholder="Masukkan password baru" 
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Konfirmasi Password Baru</label>
                <input 
                  className="w-full bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-on-surface-variant/50 transition-all outline-none" 
                  placeholder="Masukkan ulang password baru" 
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
              <button 
                className="bg-on-surface text-surface font-bold py-3 px-8 rounded-xl hover:bg-white transition-colors active:scale-95 disabled:opacity-50" 
                type="submit"
                disabled={changingPassword}
              >
                {changingPassword ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </form>
          </div>

          {/* CARD 2: Perangkat Login */}
          <div className="col-span-12 lg:col-span-5 bg-surface-container-low border border-outline-variant rounded-2xl p-8 flex flex-col">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-surface-container-highest border border-outline-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant">devices</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Perangkat Login</h3>
                <p className="text-sm text-on-surface-variant">Perangkat yang saat ini login ke akun Anda.</p>
              </div>
            </div>
            <div className="space-y-4 flex-1">
              {/* Device Item 1 */}
              <div className="flex items-center gap-4 p-4 bg-surface-container rounded-xl border border-outline-variant/50">
                <span className="material-symbols-outlined text-on-surface-variant">laptop_mac</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-on-surface">MacBook Air M1</p>
                    <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-bold uppercase">Perangkat Ini</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">macOS • Chrome • Jakarta, Indonesia</p>
                </div>
              </div>
              
              {/* Device Item 2 */}
              <div className="flex items-center gap-4 p-4 bg-surface-container rounded-xl border border-outline-variant/50">
                <span className="material-symbols-outlined text-on-surface-variant">smartphone</span>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-on-surface">iPhone 13</p>
                    <span className="text-[10px] text-on-surface-variant uppercase">3 hari yang lalu</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">iOS • Safari • Jakarta, Indonesia</p>
                </div>
                <button className="text-on-surface-variant hover:text-on-surface transition-colors">
                  <span className="material-symbols-outlined text-[18px]">more_vert</span>
                </button>
              </div>
              
              {/* Device Item 3 */}
              <div className="flex items-center gap-4 p-4 bg-surface-container rounded-xl border border-outline-variant/50">
                <span className="material-symbols-outlined text-on-surface-variant">desktop_windows</span>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold text-on-surface">Windows PC</p>
                    <span className="text-[10px] text-on-surface-variant uppercase">1 minggu lalu</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">Windows • Chrome • Bandung, Indonesia</p>
                </div>
                <button className="text-on-surface-variant hover:text-on-surface transition-colors">
                  <span className="material-symbols-outlined text-[18px]">more_vert</span>
                </button>
              </div>
            </div>
            
            <button className="w-full mt-6 flex items-center justify-between group p-2 text-sm text-on-surface-variant hover:text-on-surface transition-all">
              <span>Lihat semua perangkat login</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>
          </div>

          {/* CARD 3: Notifikasi */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-surface-container-low border border-outline-variant rounded-2xl p-8">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-surface-container-highest border border-outline-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Notifikasi</h3>
                <p className="text-sm text-on-surface-variant">Atur preferensi notifikasi Anda.</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Notifikasi Push</p>
                  <p className="text-[11px] text-on-surface-variant">Terima notifikasi di browser atau perangkat.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={pushEnabled}
                    onChange={() => setPushEnabled(!pushEnabled)}
                  />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Notifikasi Email</p>
                  <p className="text-[11px] text-on-surface-variant">Terima notifikasi penting melalui email.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={emailEnabled}
                    onChange={() => setEmailEnabled(!emailEnabled)}
                  />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>

          {/* CARD 4: Hapus Akun */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-surface-container-low border border-outline-variant rounded-2xl p-8">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-error/10 border border-error/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-error">delete_forever</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Hapus Akun</h3>
                <p className="text-sm text-on-surface-variant">Hapus akun Anda secara permanen.</p>
              </div>
            </div>
            <div className="bg-error/10 border border-error/20 rounded-xl p-4 flex gap-3 mb-8">
              <span className="material-symbols-outlined text-error text-[18px] shrink-0">warning</span>
              <p className="text-[11px] text-error leading-relaxed font-medium">Semua data akan dihapus secara permanen dan tidak dapat dipulihkan.</p>
            </div>
            <button 
              onClick={handleDeleteAccount}
              className="w-full border border-error/50 text-error font-bold py-3 rounded-xl hover:bg-error hover:text-white transition-all active:scale-95"
            >
              Hapus Akun
            </button>
          </div>

          {/* CARD 5: Log Out */}
          <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-surface-container-low border border-outline-variant rounded-2xl p-8 flex flex-col">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-surface-container-highest border border-outline-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant">logout</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">Log Out</h3>
                <p className="text-sm text-on-surface-variant">Keluar dari akun Anda saat ini.</p>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mb-10 text-center flex-1">Anda akan keluar dari semua perangkat ini.</p>
            <button 
              onClick={handleLogout}
              className="w-full bg-surface-container border border-outline-variant text-on-surface font-bold py-3 rounded-xl hover:bg-surface-container-highest transition-all active:scale-95"
            >
              Log Out
            </button>
          </div>
          
        </div>
      </main>
    </div>
  );
};

export default PengaturanPage;

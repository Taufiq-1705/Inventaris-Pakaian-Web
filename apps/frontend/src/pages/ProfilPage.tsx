import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { api, type ProfileData, type ProfileStats } from '../lib/api';

const ProfilPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<ProfileStats>({ totalActivities: 0, totalTransfers: 0, totalReports: 0 });
  
  // Fetch profile and stats on mount
  useEffect(() => {
    api<ProfileData>('/api/profile')
      .then(data => {
        setFullName(data.name);
        setUsername(data.username || '');
        setEmail(data.email);
        setPhone(data.phone || '');
        setMemberSince(new Date(data.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }));
      })
      .catch(console.error);
    
    api<ProfileStats>('/api/profile/stats')
      .then(setStats)
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    
    try {
      await api('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: fullName, username, email, phone }),
      });
      
      setIsSaving(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan profil');
      setIsSaving(false);
    }
  };

  return (
    <div className="dark bg-background text-on-background min-h-screen">
      <Sidebar />
      <Header />
      
      {/* Main Content Area */}
      <main className="ml-[260px] min-h-screen p-container-padding pt-24">
        {/* Top Navigation / Header (In page header) */}
        <header className="flex justify-between items-center mb-8 h-16">
          <div className="flex flex-col">
            <h2 className="font-display-lg text-display-lg">Profil Akun</h2>
            <p className="text-on-surface-variant font-body-sm text-body-sm">Kelola informasi pribadi dan keamanan akun Anda.</p>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-gutter">
          {/* Left Side: Profile Card */}
          <div className="col-span-12 lg:col-span-4 space-y-gutter">
            <div className="glass-card rounded-xl p-8 flex flex-col items-center text-center">
              <div className="relative group mb-6">
                <div className="w-32 h-32 rounded-full border-4 border-primary/30 p-1 overflow-hidden transition-transform duration-300 group-hover:scale-105">
                  <img 
                    alt="Profile"
                    className="w-full h-full object-cover rounded-full" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVsa5Ahl32Y755SRfJZ-XtFRDPf9ka5Wk_3D1TKZ8kj4jRiObJ1xTTmKCDHpha08PqIm4bcW0sLpxUEym9VoWnanIVgqI1tYtzG5P6mjvzPNUz49Jh-v2Zydz0-NUH93kBxRAeFcvPbAApjyBapFxTFAxH90EgYAoPr9Ff6OmjrhlMmM6OpTaeCfzskdVnxnNU-zP2Vafan9UT4jxL9bd_IlfpNymZ3S1UUDCgoh4S0s1V6vUi_EKdi6HEOPL9QqeWrzSwfRh-_mYi"
                  />
                </div>
                <button className="absolute bottom-0 right-0 bg-primary text-on-primary w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-4 border-[#1e1e1e] hover:scale-110 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                </button>
              </div>
              <h3 className="font-title-sm text-title-sm text-on-surface mb-1">{fullName || 'Loading...'}</h3>
              <p className="text-primary font-body-sm text-body-sm mb-4">{email}</p>
              <div className="bg-surface-container-highest/30 px-4 py-2 rounded-full mb-6">
                <p className="font-label-caps text-[10px] text-on-surface-variant opacity-80 uppercase tracking-widest">Member sejak: {memberSince || '...'}</p>
              </div>
              <button className="w-full py-3 border border-outline-variant rounded-lg font-body-sm text-body-sm font-semibold text-on-surface hover:bg-surface-variant transition-all active:scale-[0.98]">
                Ubah Foto
              </button>
            </div>
            
            <div className="glass-card rounded-xl p-6">
              <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-4 uppercase">Statistik Aktivitas</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-body-sm font-body-sm text-on-surface-variant">Barang Masuk</span>
                  <span className="text-body-sm font-mono-data text-secondary">+{stats.totalActivities}</span>
                </div>
                <div className="w-full h-[1px] bg-outline-variant/30"></div>
                <div className="flex justify-between items-center">
                  <span className="text-body-sm font-body-sm text-on-surface-variant">Mutasi Selesai</span>
                  <span className="text-body-sm font-mono-data text-primary">{stats.totalTransfers}</span>
                </div>
                <div className="w-full h-[1px] bg-outline-variant/30"></div>
                <div className="flex justify-between items-center">
                  <span className="text-body-sm font-body-sm text-on-surface-variant">Laporan Dibuat</span>
                  <span className="text-body-sm font-mono-data text-tertiary">{stats.totalReports}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Account Information Form */}
          <div className="col-span-12 lg:col-span-8">
            <div className="glass-card rounded-xl p-8 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <span className="material-symbols-outlined text-primary">manage_accounts</span>
                <h3 className="font-headline-md text-headline-md text-on-surface">Informasi Akun</h3>
              </div>
              
              <form className="space-y-6 flex-1" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-label-caps text-label-caps text-on-surface-variant ml-1">NAMA LENGKAP</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">person</span>
                      <input 
                        className="w-full pl-12 pr-4 py-3 rounded-lg custom-input font-body-md text-body-md text-on-surface bg-[#10131a] border border-white/15 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                        type="text" 
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-label-caps text-label-caps text-on-surface-variant ml-1">USERNAME</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">alternate_email</span>
                      <input 
                        className="w-full pl-12 pr-4 py-3 rounded-lg custom-input font-body-md text-body-md text-on-surface bg-[#10131a] border border-white/15 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                        type="text" 
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant ml-1">EMAIL</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">mail</span>
                    <input 
                      className="w-full pl-12 pr-4 py-3 rounded-lg custom-input font-body-md text-body-md text-on-surface bg-[#10131a] border border-white/15 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                      type="email" 
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant ml-1">NOMOR TELEPON</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">phone</span>
                    <input 
                      className="w-full pl-12 pr-4 py-3 rounded-lg custom-input font-body-md text-body-md text-on-surface bg-[#10131a] border border-white/15 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                      type="tel" 
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-outline-variant/30 flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                    <span className="text-xs italic">Terakhir diubah: 2 hari yang lalu</span>
                  </div>
                  <div className="flex gap-4">
                    <button className="px-6 py-3 border border-outline-variant rounded-lg font-body-sm text-body-sm font-bold hover:bg-surface-variant transition-all" type="button">
                      Batal
                    </button>
                    <button 
                      className={`px-8 py-3 rounded-lg font-body-sm text-body-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2 ${isSaved ? 'bg-secondary text-on-secondary hover:opacity-100' : 'bg-primary text-on-primary hover:opacity-90'}`} 
                      type="submit"
                      disabled={isSaving || isSaved}
                    >
                      {isSaving ? (
                        <>
                          <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                          Menyimpan...
                        </>
                      ) : isSaved ? (
                        <>
                          <span className="material-symbols-outlined text-lg">check_circle</span>
                          Berhasil Disimpan
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">save</span>
                          Simpan Perubahan
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <footer className="mt-12 mb-6 flex flex-col md:flex-row justify-between items-center opacity-50 px-2">
          <p className="font-body-sm text-body-sm">© 2024 GarmentFlow Inventory System. Hak Cipta Dilindungi.</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a className="hover:text-primary transition-colors text-body-sm font-body-sm" href="#">Kebijakan Privasi</a>
            <a className="hover:text-primary transition-colors text-body-sm font-body-sm" href="#">Bantuan</a>
            <a className="hover:text-primary transition-colors text-body-sm font-body-sm" href="#">Log Sistem</a>
          </div>
        </footer>
      </main>

      {/* Floating Action Background Element */}
      <div className="fixed top-0 right-0 -z-10 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] rounded-full bg-secondary/5 blur-[150px]"></div>
      </div>
    </div>
  );
};

export default ProfilPage;

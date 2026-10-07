import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '../lib/auth-client';

const LoginPage: React.FC = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isRegisterMode) {
      if (!fullName || !username || !phone || !email || !password) {
        setError('Semua kolom pendaftaran wajib diisi');
        return;
      }

      setLoading(true);
      try {
        // username & phone are Better Auth `additionalFields` declared on the backend
        const extraFields: Record<string, string> = { username, phone };
        const { error: signUpError } = await authClient.signUp.email({
          name: fullName,
          email,
          password,
          ...extraFields,
        });

        if (signUpError) {
          setError(signUpError.message || 'Pendaftaran gagal');
          setLoading(false);
          return;
        }

        setLoading(false);
        setSuccess('Pendaftaran berhasil! Silakan login dengan akun Anda.');
        setTimeout(() => {
          setIsRegisterMode(false);
          setSuccess('');
          setPassword('');
        }, 2000);
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat mendaftar');
        setLoading(false);
      }

    } else {
      if (!email || !password) {
        setError('Email dan Kata Sandi harus diisi');
        return;
      }

      setLoading(true);
      try {
        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message || 'Email atau password salah');
          setLoading(false);
          return;
        }

        navigate('/dashboard');
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat login');
        setLoading(false);
      }
    }
  };

  const toggleMode = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setSuccess('');
    // Reset specific fields when toggling
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-gutter relative overflow-hidden bg-[#121212] text-[#e1e2ec] font-body-sm dark">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[120px]"></div>
      </div>

      {/* Main Login/Register Container */}
      <main className="relative z-10 w-full max-w-[480px] animate-in fade-in slide-in-from-bottom-4 duration-700 my-8">
        <div
          className="rounded-xl overflow-hidden border border-white/5 relative"
          style={{
            backgroundColor: '#252525',
            boxShadow: '0px 4px 12px rgba(0,0,0,0.4)',
            background: 'radial-gradient(circle at 50% -20%, rgba(59, 130, 246, 0.15), transparent 70%)'
          }}
        >
          {/* Card Header & Brand */}
          <div className="p-8 pb-4 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container-highest mb-6 border border-white/10">
              <span className="material-symbols-outlined text-primary text-[32px]">{isRegisterMode ? 'person_add' : 'inventory_2'}</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface mb-2 tracking-tight">
              {isRegisterMode ? 'Daftar Akun Baru' : 'Sistem Inventaris'}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {isRegisterMode ? 'Lengkapi profil untuk bergabung' : 'Gudang Garment'}
            </p>
          </div>

          {/* Login/Register Form */}
          <form className="p-8 pt-4 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-error/10 text-error px-4 py-2 rounded-lg text-body-sm font-medium border border-error/20">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg text-body-sm font-medium border border-secondary/20">
                {success}
              </div>
            )}

            {isRegisterMode && (
              <>
                {/* Nama Lengkap Input */}
                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Nama Lengkap</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary">person</span>
                    <input
                      className="w-full bg-[#121212] border border-white/10 rounded-lg py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-body-md text-body-md"
                      placeholder="Masukkan nama lengkap"
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Username Input */}
                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Username</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary">alternate_email</span>
                    <input
                      className="w-full bg-[#121212] border border-white/10 rounded-lg py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-body-md text-body-md"
                      placeholder="Pilih username"
                      required
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                {/* No Telepon Input */}
                <div className="space-y-2">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">No Telepon</label>
                  <div className="relative group">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary">phone</span>
                    <input
                      className="w-full bg-[#121212] border border-white/10 rounded-lg py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-body-md text-body-md"
                      placeholder="0812xxxxxx"
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Input */}
            <div className="space-y-2">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Email {isRegisterMode ? '' : 'Logistik'}</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary">mail</span>
                <input
                  className="w-full bg-[#121212] border border-white/10 rounded-lg py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-body-md text-body-md"
                  placeholder={isRegisterMode ? "email@domain.com" : "admin@gudanggarment.com"}
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Kata Sandi</label>
                {!isRegisterMode && (
                  <a className="text-[12px] font-medium text-primary hover:underline transition-all" href="#">Lupa sandi?</a>
                )}
              </div>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary">lock</span>
                <input
                  className="w-full bg-[#121212] border border-white/10 rounded-lg py-3 pl-10 pr-4 text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all font-body-md text-body-md"
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              className={`w-full ${loading || success ? 'bg-secondary-container text-on-secondary-container' : 'bg-[#3B82F6] hover:bg-blue-600 text-white'} font-bold py-3.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${loading || success ? '' : 'shadow-blue-500/20 active:scale-[0.98]'}`}
              type="submit"
              disabled={loading || !!success}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                  <span>Memproses...</span>
                </>
              ) : success ? (
                <>
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>Sukses</span>
                </>
              ) : (
                <>
                  <span className="font-body-md text-body-md">{isRegisterMode ? 'Daftar Sekarang' : 'Login Sistem'}</span>
                  <span className="material-symbols-outlined text-[20px]">{isRegisterMode ? 'how_to_reg' : 'login'}</span>
                </>
              )}
            </button>

            {/* Action Links */}
            <div className="pt-4 text-center">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {isRegisterMode ? 'Sudah memiliki akun?' : 'Belum memiliki akses?'}
                <button
                  onClick={toggleMode}
                  type="button"
                  className="text-primary font-semibold hover:text-primary-fixed-dim transition-colors ml-1"
                >
                  {isRegisterMode ? 'Login di sini' : 'Daftar Akun Baru'}
                </button>
              </p>
            </div>
          </form>

          {/* Bottom Decoration */}
          <div className="h-1 w-full flex">
            <div className="h-full w-1/3 bg-primary"></div>
            <div className="h-full w-1/3 bg-secondary"></div>
            <div className="h-full w-1/3 bg-tertiary"></div>
          </div>
        </div>

        {/* Footer / Compliance */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-on-surface-variant opacity-50 italic">
            Masih dalam tahap pengembangan!!!
          </p>
        </footer>
      </main>

      {/* Side Illustration (Decorative Card) */}
      <div className="hidden xl:block absolute right-[-5%] top-1/2 -translate-y-1/2 opacity-20 pointer-events-none rotate-6">
        <div className="w-[600px] h-[400px] bg-surface-container rounded-2xl border border-white/10 p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded bg-primary/20"></div>
            <div className="space-y-2">
              <div className="w-32 h-4 bg-white/10 rounded"></div>
              <div className="w-20 h-3 bg-white/5 rounded"></div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="w-full h-8 bg-white/5 rounded"></div>
            <div className="w-full h-8 bg-white/5 rounded"></div>
            <div className="w-full h-8 bg-white/5 rounded"></div>
            <div className="w-2/3 h-8 bg-white/5 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

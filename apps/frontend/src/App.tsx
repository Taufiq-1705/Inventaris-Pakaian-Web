import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authClient } from './lib/auth-client';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MonitoringPage from './pages/MonitoringPage';
import PindahBarangPage from './pages/PindahBarangPage';
import TambahBarangPage from './pages/TambahBarangPage';
import KeluarBarangPage from './pages/KeluarBarangPage';
import ProfilPage from './pages/ProfilPage';
import PengaturanPage from './pages/PengaturanPage';

/**
 * Wrapper that redirects to /login if no active session.
 * Shows a loading spinner while checking auth status.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">sync</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const App: React.FC = () => {
  return (
    <Router>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/monitoring" element={<ProtectedRoute><MonitoringPage /></ProtectedRoute>} />
        <Route path="/tambah-barang" element={<ProtectedRoute><TambahBarangPage /></ProtectedRoute>} />
        <Route path="/keluar-barang" element={<ProtectedRoute><KeluarBarangPage /></ProtectedRoute>} />
        <Route path="/pindah-barang" element={<ProtectedRoute><PindahBarangPage /></ProtectedRoute>} />
        <Route path="/profil" element={<ProtectedRoute><ProfilPage /></ProtectedRoute>} />
        <Route path="/pengaturan" element={<ProtectedRoute><PengaturanPage /></ProtectedRoute>} />
      </Routes>
      </ErrorBoundary>
    </Router>
  );
};

export default App;

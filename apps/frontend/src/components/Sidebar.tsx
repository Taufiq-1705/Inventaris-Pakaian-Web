import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  return (
    <aside className="w-sidebar-width h-screen fixed left-0 top-0 bg-surface-container dark:bg-surface-dim shadow-md flex flex-col py-gutter z-50">
      <div className="px-6 mb-8">
        <h1 className="font-headline-md text-headline-md font-bold text-primary dark:text-primary">Sistem Inventaris</h1>
        <p className="text-body-sm text-on-surface-variant">Gudang Garment</p>
      </div>
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {/* Active: Dashboard */}
        <Link 
          to="/dashboard"
          className={`flex items-center px-4 py-3 transition-colors duration-200 ${currentPath === '/dashboard' ? 'text-primary font-bold border-r-4 border-primary bg-surface-variant' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined mr-3">dashboard</span>
          <span className="font-body-md text-body-md">Dashboard</span>
        </Link>
        <Link 
          to="/monitoring"
          className={`flex items-center px-4 py-3 transition-colors duration-200 ${currentPath === '/monitoring' ? 'text-primary font-bold border-r-4 border-primary bg-surface-variant' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined mr-3">inventory_2</span>
          <span className="font-body-md text-body-md">Monitoring Barang</span>
        </Link>
        <Link 
          to="/tambah-barang"
          className={`flex items-center px-4 py-3 transition-colors duration-200 ${currentPath === '/tambah-barang' ? 'text-primary font-bold border-r-4 border-primary bg-surface-variant' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined mr-3">add_box</span>
          <span className="font-body-md text-body-md">Tambah Barang</span>
        </Link>
        <Link 
          to="/keluar-barang"
          className={`flex items-center px-4 py-3 transition-colors duration-200 ${currentPath === '/keluar-barang' ? 'text-primary font-bold border-r-4 border-primary bg-surface-variant' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined mr-3">history</span>
          <span className="font-body-md text-body-md">Keluar Barang</span>
        </Link>
        <Link 
          to="/pindah-barang"
          className={`flex items-center px-4 py-3 transition-colors duration-200 ${currentPath === '/pindah-barang' ? 'text-primary font-bold border-r-4 border-primary bg-surface-variant' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined mr-3">move_item</span>
          <span className="font-body-md text-body-md">Pindah Barang</span>
        </Link>

        <div className="pt-4 mt-auto border-t border-outline-variant">
          <Link 
            to="/profil"
            className={`flex items-center px-4 py-3 transition-colors duration-200 ${currentPath === '/profil' ? 'text-primary font-bold border-r-4 border-primary bg-surface-variant' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined mr-3">person</span>
            <span className="font-body-md text-body-md">Profil</span>
          </Link>
          <Link 
            to="/pengaturan"
            className={`flex items-center px-4 py-3 transition-colors duration-200 ${currentPath === '/pengaturan' ? 'text-primary font-bold border-r-4 border-primary bg-surface-variant' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined mr-3">settings</span>
            <span className="font-body-md text-body-md">Pengaturan</span>
          </Link>
        </div>
      </nav>
      <div className="px-6 mt-4">
        <button 
          onClick={() => {
            if(window.confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
              navigate('/login');
            }
          }}
          className="flex items-center w-full gap-4 px-4 py-3 text-error rounded-lg hover:bg-error-container/20 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined" data-icon="logout">logout</span>
          <span className="font-body-md text-body-md font-semibold">Keluar</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

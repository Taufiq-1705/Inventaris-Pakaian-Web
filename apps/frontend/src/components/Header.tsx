import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ProfileData, type ItemData } from '../lib/api';

// Pages list for navigation search
const PAGE_LINKS = [
  { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { name: 'Monitoring Barang', path: '/monitoring', icon: 'inventory_2' },
  { name: 'Tambah Barang', path: '/tambah-barang', icon: 'add_box' },
  { name: 'Keluar Barang', path: '/keluar-barang', icon: 'history' },
  { name: 'Pindah Barang', path: '/pindah-barang', icon: 'move_item' },
  { name: 'Profil', path: '/profil', icon: 'person' },
  { name: 'Pengaturan', path: '/pengaturan', icon: 'settings' },
];

const Header: React.FC = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ItemData[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<ProfileData>('/api/profile')
      .then(data => setUserName(data.name || ''))
      .catch(() => {});
  }, []);

  // Debounced search
  const fetchSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const data = await api<{ items: ItemData[] }>(`/api/items?search=${encodeURIComponent(query)}&limit=5`);
      setSearchResults(data.items || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.trim()) {
        fetchSearch(searchQuery);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, fetchSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter matching pages
  const matchingPages = searchQuery.trim()
    ? PAGE_LINKS.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const handleNavigateToItem = (itemCode: string) => {
    setShowDropdown(false);
    setSearchQuery('');
    navigate(`/monitoring?search=${encodeURIComponent(itemCode)}`);
  };

  const handleNavigateToPage = (path: string) => {
    setShowDropdown(false);
    setSearchQuery('');
    navigate(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setShowDropdown(false);
      navigate(`/monitoring?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Get initials from user name
  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const hasResults = matchingPages.length > 0 || searchResults.length > 0;

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-260px)] h-16 bg-surface-container-high dark:bg-surface-container-high shadow-sm flex justify-between items-center px-container-padding z-40">
      {/* Search Bar */}
      <div className="flex items-center flex-1 max-w-xl" ref={dropdownRef}>
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            ref={inputRef}
            className="w-full bg-surface dark:bg-surface border-none rounded-full pl-10 pr-4 py-2 text-body-sm focus:ring-2 focus:ring-primary"
            placeholder="Cari SKU, Lokasi, atau Nama Barang..."
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchQuery.trim()) setShowDropdown(true); }}
            onKeyDown={handleKeyDown}
          />

          {/* Search Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container rounded-xl shadow-2xl border border-outline-variant overflow-hidden z-50 max-h-[400px] overflow-y-auto custom-scrollbar">
              {/* Matching Pages */}
              {matchingPages.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-high">
                    📄 Halaman
                  </div>
                  {matchingPages.map(p => (
                    <button
                      key={p.path}
                      onClick={() => handleNavigateToPage(p.path)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors text-left"
                    >
                      <span className="material-symbols-outlined text-primary text-[20px]">{p.icon}</span>
                      <span className="text-body-sm text-on-surface">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Matching Items */}
              {searchLoading ? (
                <div className="px-4 py-6 text-center">
                  <span className="material-symbols-outlined text-primary text-2xl animate-spin">sync</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div>
                  <div className="px-4 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-high">
                    📦 Barang
                  </div>
                  {searchResults.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigateToItem(item.code)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors text-left"
                    >
                      <div className="flex flex-col">
                        <span className="text-body-sm font-bold text-on-surface">{item.name}</span>
                        <span className="text-[11px] text-on-surface-variant font-mono">{item.code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-on-surface-variant">{item.warehouseName}</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                          {item.quantity} Pcs
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() && !searchLoading && matchingPages.length === 0 ? (
                <div className="px-4 py-6 text-center text-on-surface-variant text-body-sm">
                  Tidak ada hasil untuk "{searchQuery}"
                </div>
              ) : null}

              {/* Enter hint */}
              {hasResults && (
                <div className="px-4 py-2 border-t border-outline-variant bg-surface-container-high text-[10px] text-on-surface-variant">
                  Tekan <kbd className="px-1.5 py-0.5 bg-surface-variant rounded text-[10px] font-mono">Enter</kbd> untuk pencarian lengkap di Monitoring Barang
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        <button className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-variant transition-transform duration-150 active:scale-95">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div className="h-8 w-[1px] bg-outline-variant mx-2"></div>
        <button
          className="flex items-center gap-3 hover:bg-surface-variant px-3 py-1.5 rounded-full transition-colors cursor-pointer"
          onClick={() => navigate('/profil')}
        >
          <span className="font-title-sm text-title-sm text-primary truncate max-w-[150px]">
            {userName || '...'}
          </span>
          <div className="w-9 h-9 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-sm">
            {getInitials(userName)}
          </div>
        </button>
      </div>
    </header>
  );
};

export default Header;

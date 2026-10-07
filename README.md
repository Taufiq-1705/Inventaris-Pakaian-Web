# 🧵 GarmentFlow V2 — Warehouse Management System

> **Sistem Manajemen Inventaris & Pergudangan Modern untuk Industri Pakaian Jadi & Retail Konveksi.**

GarmentFlow V2 adalah solusi *Warehouse Management System* (WMS) berbasis monorepo modern yang dirancang khusus untuk memonitor, mengelola, dan mengoptimalkan siklus rantai pasok pakaian jadi. Sistem ini mencakup pemantauan stok multi-gudang secara *real-time*, penanganan alokasi kategori spesifik per gudang, pelacakan mutasi barang antargudang (*inter-warehouse transfer*), manajemen transaksi pengeluaran barang (*outgoing transactions*), serta pencatatan audit log aktivitas secara otomatis.

---

## 🏗️ Arsitektur Monorepo

Proyek ini dibangun menggunakan **NPM Workspaces** untuk memisahkan logika antarmuka (*frontend*) dan server (*backend*) ke dalam paket independen namun tetap berada dalam satu repositori (*single source of truth*).

```text
InventariPakaianV2/
├── apps/
│   ├── backend/             # REST API Server & Database Layer
│   │   ├── src/
│   │   │   ├── db/          # Schema Drizzle, koneksi DB, dan database seeder
│   │   │   ├── lib/         # Konfigurasi Better Auth server
│   │   │   ├── middleware/  # Middleware autentikasi (requireAuth)
│   │   │   └── routes/      # Controller & endpoint REST API
│   │   ├── drizzle.config.ts# Konfigurasi Drizzle Kit
│   │   ├── package.json     # Dependensi backend
│   │   └── tsconfig.json
│   │
│   └── frontend/            # Client Application SPA (Single Page App)
│       ├── src/
│       │   ├── components/  # Komponen UI modular (Navbar, Sidebar, Modal, dll)
│       │   ├── lib/         # Client Better Auth & wrapper API fetch
│       │   ├── pages/       # Halaman aplikasi (Dashboard, Monitoring, Mutasi, dll)
│       │   ├── App.tsx      # Routing & route guards
│       │   └── index.css    # Desain sistem & Tailwind CSS v4 styling
│       ├── package.json     # Dependensi frontend
│       └── vite.config.ts   # Konfigurasi bundler Vite
│
├── docs/                    # Dokumentasi teknis mendalam (Arsitektur, API, DB)
│   ├── ARCHITECTURE.md
│   └── SECURITY.md          # Kebijakan kredensial & checklist keamanan
│
├── .env.example             # Template konfigurasi variabel lingkungan backend
├── package.json             # Root workspace konfigurasi NPM
└── README.md                # Dokumentasi utama proyek
```

### Keuntungan Struktur Ini:
1. **Isolated Dependencies**: Frontend dan backend memiliki `package.json` terisolasi sehingga dependensi server tidak menggelembungkan bundle client.
2. **Unified Command**: Perintah instalasi, migrasi database, dan eksekusi server dapat dipicu dari direktori root.
3. **Clean Boundaries**: Pemisahan yang tegas antara layer presentasi (React 19) dan layer persistensi data (Express v5 & Drizzle ORM).

---

## ⚡ Tech Stack Summary

| Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) | Library UI komponen berbasis React Compiler & hooks terbaru |
| **Styling & Design System** | [Tailwind CSS v4](https://tailwindcss.com/) | Engine CSS generasi ke-4 yang cepat dengan modern aesthetic |
| **Build Tool & Bundler** | [Vite 8](https://vite.dev/) | Next-generation frontend tooling dengan Fast HMR |
| **Backend Framework** | [Express v5](https://expressjs.com/) | Web framework Node.js modern dengan penanganan promise native |
| **Runtime & Language** | [TypeScript](https://www.typescriptlang.org/) & [Node.js](https://nodejs.org/) | Type-safe end-to-end development |
| **Database Engine** | [PostgreSQL](https://www.postgresql.org/) | Relational Database Management System berkinerja tinggi |
| **ORM & Migrations** | [Drizzle ORM](https://orm.drizzle.team/) & [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) | TypeScript ORM dengan zero-overhead dan SQL dialect native |
| **Authentication Engine** | [Better Auth](https://www.better-auth.com/) | Solusi autentikasi modern berbasis session, secure cookie, dan Drizzle adapter |
| **Visualisasi Data** | [Chart.js](https://www.chartjs.org/) & [React-Chartjs-2](https://react-chartjs-2.js.org/) | Grafik interaktif tren arus barang masuk dan keluar |

---

## 🚀 Panduan Instalasi & Memulai (Getting Started)

### 1. Prasyarat Sistem (Prerequisites)
Pastikan lingkungan lokal Anda telah terpasang:
- **Node.js**: Versi `v18.0.0` atau lebih baru (direkomendasikan LTS `v20.x`).
- **NPM**: Versi `v9.x` atau lebih baru.
- **PostgreSQL**: Server PostgreSQL aktif (`v14` ke atas) yang berjalan pada port default `5432` atau port kustom.

---

### 2. Kloning Repository & Instalasi Dependensi
Buka terminal dan jalankan perintah berikut:

```bash
# Clone repositori
git clone https://github.com/Taufiq-1705/Inventaris-Pakaian-Web.git
cd Inventaris-Pakaian-Web

# Instal seluruh dependensi root, backend, dan frontend sekaligus
npm install
```

---

### 3. Konfigurasi Variabel Lingkungan (.env)

Salin template untuk backend **dan** frontend:

```bash
# macOS / Linux / Git Bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# Windows PowerShell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/frontend/.env.example apps/frontend/.env
```

Buka `apps/backend/.env` dan sesuaikan nilainya:
```env
# URL Koneksi PostgreSQL (Sesuaikan user, password, host, port, dan dbname)
DATABASE_URL=postgresql://postgres:password_kamu@localhost:5432/inventaris_pakaian

# Kunci Rahasia Better Auth — WAJIB diganti dengan string acak (min. 32 karakter)
BETTER_AUTH_SECRET=<hasil-generate-di-bawah>
BETTER_AUTH_URL=http://localhost:3001

# Port Backend & URL Frontend
PORT=3001
FRONTEND_URL=http://localhost:5173
```

Generate `BETTER_AUTH_SECRET` yang aman:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> [!IMPORTANT]
> Backend **menolak start** jika `DATABASE_URL` / `BETTER_AUTH_SECRET` kosong, secret kurang dari 32 karakter, atau masih memakai nilai contoh dari `.env.example`. File `.env` sudah di-ignore oleh Git — **jangan pernah commit file `.env`**. Lihat [`docs/SECURITY.md`](docs/SECURITY.md).

`apps/frontend/.env` berisi alamat backend (default sudah benar untuk lokal):
```env
VITE_API_URL=http://localhost:3001
```

---

### 4. Setup Database (Migrasi & Seeding Data)

Pastikan database PostgreSQL kosong telah dibuat (misalnya dengan nama `inventaris_pakaian`):

```sql
-- Jalankan di psql / pgAdmin / DBeaver jika database belum ada:
CREATE DATABASE inventaris_pakaian;
```

Jalankan perintah sinkronisasi skema dan seeder langsung dari direktori root:

```bash
# 1. Terapkan skema tabel Drizzle ke PostgreSQL
npm run db:push

# 2. Isi database dengan data master (Kategori, Tipe Pakaian, Gudang, dummy data)
npm run db:seed
```

> **Data Master yang Dihasilkan oleh Seeder:**
> - **Kategori**: `Pakaian Atas` (Kaos, Kemeja, Polo, Sweater, Hoodie) & `Pakaian Bawah` (Celana Panjang, Celana Pendek, Jeans, Rok).
> - **Gudang**:
>   - *Gudang 1* (Kapasitas: 2.500 pcs) — Khusus Pakaian Atas
>   - *Gudang 2* (Kapasitas: 2.000 pcs) — Khusus Pakaian Bawah
>   - *Gudang 3* (Kapasitas: 2.000 pcs) — Campuran (Pakaian Atas & Bawah)

---

### 5. Menjalankan Aplikasi di Lingkungan Lokal

Jalankan backend + frontend sekaligus dari direktori root (menggunakan `concurrently`):

```bash
npm run dev
```

| Service | URL |
| :--- | :--- |
| Frontend (Vite) | `http://localhost:5173` |
| Backend (Express) | `http://localhost:3001` |
| Health check | `http://localhost:3001/api/health` |

Tekan `Ctrl+C` untuk menghentikan keduanya. Jika ingin menjalankan terpisah, gunakan `npm run dev:backend` dan `npm run dev:frontend` di dua terminal.

Buka peramban Anda di [http://localhost:5173](http://localhost:5173) untuk mengakses sistem GarmentFlow V2.

#### Troubleshooting
| Gejala | Penyebab & Solusi |
| :--- | :--- |
| `[env] Konfigurasi apps/backend/.env tidak valid` | Lengkapi `.env` sesuai pesan error (lihat langkah 3). |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL belum berjalan. Windows: `Get-Service postgresql*` lalu `Start-Service <nama>` (perlu Administrator). |
| `EADDRINUSE :3001` / `:5173` | Port sudah dipakai proses lain — hentikan proses lama atau ubah `PORT`. |
| Login gagal setelah ganti secret | Normal: sesi lama tidak valid lagi. Login ulang. |
| `429 Terlalu banyak percobaan` | Rate limit login (10x / 15 menit / IP). Tunggu atau restart backend (limit disimpan di memori). |

---

## 🛠️ Ringkasan Perintah NPM (NPM Scripts)

| Perintah | Lokasi Eksekusi | Deskripsi |
| :--- | :--- | :--- |
| `npm run dev` | Root | Menjalankan backend + frontend sekaligus (`concurrently`) |
| `npm run dev:frontend` | Root | Menjalankan Vite dev server untuk frontend (`:5173`) |
| `npm run dev:backend` | Root | Menjalankan Express dev server dengan `tsx watch` (`:3001`) |
| `npm run db:push` | Root | Melakukan sinkronisasi skema Drizzle ORM langsung ke database |
| `npm run db:seed` | Root | Menjalankan skrip seeder untuk mengisi data master & simulasi |
| `npm run db:studio` | Root | Membuka Drizzle Studio (Database GUI Visualizer di browser) |
| `npm run build --workspace=apps/frontend` | Root | Membangun bundle produksi untuk frontend |
| `npm run build --workspace=apps/backend` | Root | Melakukan kompilasi TypeScript untuk backend |

---

## 📖 Dokumentasi Teknis Lanjutan

Untuk membaca dokumentasi arsitektur mendalam, detail skema database, alur autentikasi Better Auth, dan daftar lengkap REST API endpoints, silakan pelajari dokumen:
👉 **[`docs/ARCHITECTURE.md`](file:///d:/InventariPakaianV2/docs/ARCHITECTURE.md)**

---

## 🔒 Keamanan

| Lapisan | Implementasi |
| :--- | :--- |
| Kredensial | `.env` di-ignore Git; hanya `.env.example` (placeholder) yang di-commit |
| Validasi konfigurasi | `src/lib/env.ts` — server berhenti jika secret kosong/lemah/nilai contoh |
| Brute-force | `express-rate-limit` — 10 percobaan / 15 menit / IP pada sign-in & sign-up |
| HTTP headers | `helmet` (X-Frame-Options, CSP, nosniff, dll.) + `x-powered-by` dimatikan |
| Payload | `express.json({ limit: "1mb" })` |
| Error handling | Handler global JSON; stack trace tidak pernah dikirim ke client |
| Sesi | Better Auth — cookie HTTP-only, sesi disimpan di database |
| Data scoping | Semua query difilter per `req.user.id` |

Kebijakan lengkap & checklist sebelum push: 👉 **[`docs/SECURITY.md`](docs/SECURITY.md)**

---

## ⚠️ Known Limitations & Pending Features (Daftar Hal yang Masih Perlu Dikembangkan)

Berdasarkan audit teknis arsitektur sistem terkini, berikut adalah beberapa area dan fitur yang masih dalam tahap pengembangan lanjutan (*pending*):

1. **Manajemen Sesi Perangkat Aktif (`PengaturanPage`)**:
   - Tampilan daftar perangkat login ("MacBook Air M1", "iPhone 13", dll.) saat ini masih berupa data mock statis di antarmuka. Integrasi dengan tabel `session` di database Better Auth dan fitur revokasi sesi perangkat individual sedang disiapkan.
2. **Penyimpanan Berkas Foto Profil (`ProfilPage`)**:
   - Tombol "Ubah Foto" belum terhubung dengan penyimpanan berkas fisik (*cloud object storage* seperti S3/GCS atau upload lokal). Avatar saat ini masih menggunakan URL placeholder statis.
3. **Persistensi Preferensi Notifikasi**:
   - Pengaturan *toggle* notifikasi Push dan Email pada halaman Pengaturan baru beroperasi di *state* lokal React dan belum dipersistensikan ke tabel profil basis data.
4. **Modul Ekspor & Pelaporan**:
   - Metrik statistik `totalReports` masih bernilai `0` (placeholder) karena fitur *export* laporan inventaris berkala (format PDF/Excel) masih dalam antrean pengembangan (*roadmap*).
5. **Strategi Penghapusan Data Inventaris (*Soft Delete*)**:
   - Penghapusan barang yang pernah tercatat dalam transaksi keluar (`outgoing_transaction_item`) memerlukan penerapan *soft-delete* (`is_deleted`) untuk menghindari pelanggaran batasan relasi *foreign key* PostgreSQL.
6. **Roadmap Arsitektur** (dari laporan analisis kode):
   - Memisahkan logika bisnis ke layer `services/`, shared types package frontend–backend, `@tanstack/react-query`, automated tests (Vitest), dan code-splitting bundle frontend.

> ✅ **Sudah diselesaikan:** base URL frontend kini memakai `VITE_API_URL`; global error handler, React Error Boundary, rate limiting, helmet, validasi env, dan index database telah ditambahkan.

---

## 👥 Lisensi & Kontributor
Dikembangkan untuk kebutuhan manajemen inventaris konveksi dan garmen modern.
Lisensi: **ISC**.

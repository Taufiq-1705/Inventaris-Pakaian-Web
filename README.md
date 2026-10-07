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
│   └── ARCHITECTURE.md
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
git clone https://github.com/username/InventariPakaianV2.git
cd InventariPakaianV2

# Instal seluruh dependensi root, backend, dan frontend sekaligus
npm install
```

---

### 3. Konfigurasi Variabel Lingkungan (.env)

Buat file `.env` di dalam folder `apps/backend/`:

```bash
# Salin template env ke apps/backend/.env
cp .env.example apps/backend/.env
```

Buka `apps/backend/.env` dan sesuaikan nilainya:
```env
# URL Koneksi PostgreSQL (Sesuaikan user, password, host, port, dan dbname)
DATABASE_URL=postgresql://postgres:password_kamu@localhost:5432/inventaris_pakaian

# Kunci Rahasia Better Auth (Gunakan string acak minimal 32 karakter)
BETTER_AUTH_SECRET=rahasia_super_aman_32_karakter_wajib_diubah_saat_produksi
BETTER_AUTH_URL=http://localhost:3001

# Port Backend & URL Frontend
PORT=3001
FRONTEND_URL=http://localhost:5173
```

*(Opsional)* Jika ingin mengonfigurasi endpoint API custom pada frontend, buat file `apps/frontend/.env`:
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

Untuk menjalankan frontend dan backend secara bersamaan, buka dua jendela/tab terminal di direktori root:

#### Terminal 1 — Menjalankan Backend:
```bash
npm run dev:backend
```
*Backend server aktif di:* `http://localhost:3001`

#### Terminal 2 — Menjalankan Frontend:
```bash
npm run dev:frontend
```
*Frontend aplikasi aktif di:* `http://localhost:5173`

> **Tips Alternatif:**
> Anda juga dapat menjalankan kedua service sekaligus dalam 1 perintah jika menginstal paket `concurrently` di root:
> ```bash
> npm run dev
> ```

Buka peramban Anda di [http://localhost:5173](http://localhost:5173) untuk mengakses sistem GarmentFlow V2.

---

## 🛠️ Ringkasan Perintah NPM (NPM Scripts)

| Perintah | Lokasi Eksekusi | Deskripsi |
| :--- | :--- | :--- |
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
6. **Variabel Lingkungan Frontend Client Dinamis**:
   - Klien frontend saat ini mengarah ke `http://localhost:3001` secara default dan disarankan menggunakan pengikatan `import.meta.env.VITE_API_URL` sebelum *deployment* ke multi-environment.

---

## 👥 Lisensi & Kontributor
Dikembangkan untuk kebutuhan manajemen inventaris konveksi dan garmen modern.
Lisensi: **ISC**.

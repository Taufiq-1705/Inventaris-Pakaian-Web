# 🔒 Kebijakan Keamanan — GarmentFlow V2

## 1. Pengelolaan Kredensial

| File | Di-commit? | Isi |
| :--- | :---: | :--- |
| `apps/backend/.env` | ❌ Tidak | Kredensial nyata (password DB, `BETTER_AUTH_SECRET`) |
| `apps/frontend/.env` | ❌ Tidak | `VITE_API_URL` |
| `*.env.example` | ✅ Ya | **Hanya placeholder**, tanpa nilai nyata |

Aturan:
- **Jangan pernah** menaruh password, token, atau secret di kode sumber maupun `.env.example`.
- Variabel berawalan `VITE_` **ikut ter-bundle ke browser** — jangan simpan rahasia di sana.
- `.gitignore` sudah mengabaikan `.env`, `.env.*` (kecuali `.env.example`), `*.pem`, `*.key`, `*.crt`, `secrets/`, dump database, dan `coverage/`.

## 2. `BETTER_AUTH_SECRET`

Generate (min. 32 karakter, disarankan 64 hex):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Backend (`src/lib/env.ts`) **menolak start** bila secret kosong, < 32 karakter, atau sama dengan nilai contoh.

**Rotasi secret:** ganti nilai di `apps/backend/.env`, restart backend. Semua sesi lama otomatis tidak valid → pengguna harus login ulang. Gunakan secret **berbeda** untuk setiap environment (lokal, staging, production).

## 3. Kontrol Keamanan Aplikasi

| Kontrol | Detail |
| :--- | :--- |
| Autentikasi | Better Auth, cookie sesi HTTP-only, sesi tersimpan di DB |
| Otorisasi / scoping | `requireAuth` + filter `createdById = req.user.id` di semua query |
| Rate limiting | 10 percobaan / 15 menit / IP pada sign-in & sign-up (`429`) |
| Security headers | `helmet`; `x-powered-by` dimatikan |
| CORS | Hanya origin `FRONTEND_URL`, `credentials: true` |
| Batas payload | JSON maks. 1 MB |
| Error handling | Respons JSON generik; stack trace hanya di log server |
| SQL injection | Query melalui Drizzle ORM (parameterized) |

## 4. Checklist Sebelum `git push`

```bash
# 1. Pastikan tidak ada file .env yang ter-stage
git status
git diff --cached --name-only | grep -E "\.env$"   # harus kosong

# 2. Pastikan .env memang di-ignore
git check-ignore -v apps/backend/.env apps/frontend/.env

# 3. Cari pola kredensial di file yang di-track
git grep -n -I -E "(password|secret|token)\s*[:=]\s*['\"][^'\"]{8,}" -- ':!*.example' ':!*.md'
```

## 5. Jika Kredensial Terlanjur Ter-push

1. **Anggap sudah bocor** — segera rotasi: ganti password PostgreSQL & generate `BETTER_AUTH_SECRET` baru.
2. Hapus dari riwayat Git (`git filter-repo` atau BFG Repo-Cleaner), lalu `git push --force`.
3. Aktifkan **GitHub Secret Scanning & Push Protection** di *Settings → Code security*.

## 6. Melaporkan Celah Keamanan

Laporkan secara privat ke pemilik repository melalui GitHub (Security → Report a vulnerability), bukan melalui issue publik.

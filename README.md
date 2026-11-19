# POS Coffee Shop

Aplikasi kasir (Point of Sale) untuk coffee shop berbasis **Laravel 12** + **React 19** dengan antarmuka satu halaman (SPA). Mengelola produk, stok, transaksi, struk, pengaturan toko, dan pengguna.

---

## Daftar Isi

- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Persyaratan](#persyaratan)
- [Instalasi](#instalasi)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Akun Bawaan](#akun-bawaan)
- [Panduan Penggunaan](#panduan-penggunaan)
- [Hak Akses](#hak-akses)
- [Pencetakan Struk](#pencetakan-struk)
- [Gambar & Penyimpanan](#gambar--penyimpanan)
- [Struktur Proyek](#struktur-proyek)
- [Perintah Umum](#perintah-umum)
- [Referensi Endpoint](#referensi-endpoint)
- [Pemecahan Masalah](#pemecahan-masalah)
- [Catatan Produksi](#catatan-produksi)

---

## Fitur

- **Dashboard** — omzet hari ini, jumlah transaksi, produk aktif, stok menipis, grafik 7 hari, transaksi terbaru.
- **Kasir** — pencarian produk, scan SKU/barcode dengan `Enter`, keranjang, qty, diskon per item & transaksi, nama pelanggan, catatan, 4 metode bayar (tunai, kartu, QRIS, transfer), kalkulasi kembalian, struk otomatis.
- **Produk & Kategori** — CRUD produk (foto, SKU, barcode, harga, modal, stok, ambang stok minimum, status aktif) dan kategori.
- **Stok** — mutasi masuk/keluar/penyesuaian, riwayat pergerakan, filter produk/jenis/tanggal, daftar stok menipis. Stok berkurang otomatis saat transaksi dan kembali saat void.
- **Penjualan** — riwayat transaksi, filter invoice/pelanggan/status/tanggal, detail transaksi, cetak ulang struk, unduh file ESC/POS, void transaksi (khusus admin).
- **Pengaturan Toko** — identitas toko, logo, header/footer struk, lebar kertas 58/80 mm, mata uang IDR/USD, pajak, ambang stok global, zona waktu, metode cetak browser/thermal.
- **Pengguna** — kelola akun admin & kasir. Penghapusan akun memakai *soft delete* agar riwayat transaksi tetap terbaca.
- **Autentikasi** — Sanctum token, proteksi rute API, pembagian role admin/kasir.

---

## Teknologi

| Layer | Stack |
| --- | --- |
| Backend | PHP 8.2+, Laravel 12, Laravel Sanctum 4, MySQL |
| Frontend | React 19, React Router 7, TanStack Query 5, Axios, Tailwind CSS 4, Lucide |
| Build | Vite 7, TypeScript 5 |
| Cetak | Print dialog browser / Web Serial (printer thermal ESC/POS) |

---

## Persyaratan

- PHP **8.2** atau lebih baru (ekstensi `pdo_mysql`, `mbstring`, `fileinfo`, `openssl`)
- Composer 2
- MySQL / MariaDB (database nama: `kopipos`)
- Node.js 20+ dan npm
- Web server dengan **document root** mengarah ke folder `public/` (Laragon, Apache, atau Nginx)
- Chrome / Edge jika ingin memakai printer thermal via Web Serial

---

## Instalasi

### 1. Siapkan proyek

```bash
cd C:\laragon\www\kopipos
composer install
npm install
```

### 2. Konfigurasi environment

```bash
cp .env.example .env
php artisan key:generate
```

Sesuaikan `.env` (contoh untuk Laragon + MySQL):

```dotenv
APP_NAME="POS Coffee Shop"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1

APP_LOCALE=id
APP_FALLBACK_LOCALE=id

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=kopipos
DB_USERNAME=root
DB_PASSWORD=

FILESYSTEM_DISK=public
SESSION_DRIVER=file
```

> `APP_URL` **harus sama** dengan domain yang dipakai untuk membuka aplikasi. URL gambar produk dibuat dengan `asset()`, jadi beda domain membuat gambar tidak tampil.

### 3. Database

Buat database `kopipos`, lalu jalankan:

```bash
php artisan migrate
php artisan db:seed   # opsional: akun demo + 9 produk + transaksi 7 hari
```

### 4. Symbolic link storage

Wajib agar foto produk & logo toko bisa diakses lewat `/storage/...`:

```bash
php artisan storage:link
```

> Di Windows, kalau `public/storage` sudah ada sebagai folder kosong, hapus dulu folder itu sebelum menjalankan perintah di atas.

### 5. Build aset frontend

```bash
npm run build
```

Aplikasi siap dibuka di `APP_URL` (mis. `http://127.0.0.1`).

---

## Menjalankan Aplikasi

### Mode produksi / server statis

Arahkan virtual host ke `public/`, lalu jalankan `npm run build`. Cukup itu — Laravel yang melayani SPA dan API.

### Mode pengembangan (Vite HMR)

Jalankan dua terminal:

```bash
# Terminal 1
php artisan serve

# Terminal 2
npm run dev
```

Atau sekali jalan:

```bash
composer dev
```

---

## Akun Bawaan

Tersedia setelah `php artisan db:seed`:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@toko.com` | `password` |

Tombol isi otomatis di halaman login sudah dihapus — ketik email dan password manual. **Segera ganti password** setelah login pertama (menu **Pengguna → Ubah**).

---

## Panduan Penggunaan

### 1. Masuk

Buka `/login`, masukkan email & password. Tombol mata di kolom password menampilkan/menyembunyikan teks.

### 2. Atur toko (admin)

Buka **Pengaturan**:

1. Isi nama, alamat, telepon, email, dan mata uang toko.
2. Unggah logo toko (opsional) lalu klik **Unggah logo**.
3. Atur header/footer struk, lebar kertas, pajak, ambang stok, dan zona waktu.
4. Pilih metode cetak, lalu **Simpan Pengaturan**.
5. Klik **Cetak Contoh Struk** untuk memastikan hasil cetak sesuai.

### 3. Tambah produk (admin)

Buka **Produk & Kategori**:

1. Buat kategori lebih dulu lewat tombol **Kategori** bila perlu.
2. Klik **Tambah Produk**.
3. Isi nama, kategori, SKU, barcode, harga jual, harga modal, stok awal, ambang stok minimum, dan foto.
4. Centang **Aktif** agar produk muncul di kasir.
5. Simpan.

### 4. Kelola stok (admin)

Buka **Stok → Sesuaikan Stok**, pilih produk, jenis (`Stok masuk` / `Stok keluar` / `Penyesuaian`), jumlah, dan catatan. Semua perubahan tercatat di riwayat.

### 5. Transaksi kasir

Buka **Kasir**:

1. Cari produk berdasarkan nama, SKU, atau barcode. Ketik barcode lalu tekan `Enter` untuk langsung menambah ke keranjang.
2. Klik produk untuk masuk keranjang. Atur quantity dengan tombol `+` / `−`. Stok yang tersedia menjadi batas maksimum.
3. Isi diskon per item / diskon transaksi, nama pelanggan (opsional), dan catatan.
4. Pilih metode bayar. Untuk **Tunai**, masukkan jumlah bayar — kembalian dihitung otomatis. Metode lain otomatis memakai nilai total.
5. Klik **Pratinjau struk** untuk melihat hasil cetak, lalu **Selesaikan Transaksi**.
6. Stok langsung berkurang dan struk tampil. Jika `auto_print` aktif, dialog cetak browser langsung muncul.

### 6. Riwayat penjualan

Buka **Penjualan**:

- Filter berdasarkan invoice/pelanggan, status, dan rentang tanggal.
- Klik ikon mata untuk melihat detail.
- **Cetak Struk** — cetak ulang lewat browser/thermal.
- **ESC/POS** — unduh file perintah printer thermal.
- **Void** (admin) — membatalkan transaksi dan mengembalikan stok.

### 7. Kelola pengguna (admin)

Buka **Pengguna** untuk menambah, mengubah, atau menghapus akun.

- Akun yang dihapus hilang dari daftar dan tidak bisa login.
- Riwayat transaksi & mutasi stok tetap menampilkan nama akun tersebut.
- Tidak bisa menghapus akun sendiri atau admin terakhir yang tersisa.
- Email akun yang dihapus bisa dipakai lagi untuk akun baru.

---

## Hak Akses

| Menu | Kasir | Admin |
| --- | :---: | :---: |
| Dashboard | ✅ | ✅ |
| Kasir / transaksi | ✅ | ✅ |
| Lihat produk & kategori | ✅ | ✅ |
| Tambah/ubah/hapus produk & kategori | ❌ | ✅ |
| Lihat stok & riwayat mutasi | ✅ | ✅ |
| Sesuaikan stok | ❌ | ✅ |
| Lihat riwayat penjualan & cetak struk | ✅ | ✅ |
| Void transaksi | ❌ | ✅ |
| Pengaturan toko | ❌ | ✅ |
| Kelola pengguna | ❌ | ✅ |

---

## Pencetakan Struk

### Browser (default)

- Metode cetak: `Browser / print dialog`.
- Centang **Cetak otomatis setelah transaksi** agar dialog cetak muncul segera setelah transaksi berhasil.
- Atau buka **Penjualan → detail → Cetak Struk**.

### Printer thermal (Web Serial)

- Metode cetak: `Thermal via Web Serial`.
- Gunakan **Chrome atau Edge**, lewat `localhost` atau **HTTPS**.
- Klik **Cetak Thermal**, lalu pilih port printer saat browser meminta.
- Baud rate default `9600` (sesuaikan dengan printer).
- Cetak otomatis hanya berlaku untuk metode Browser; thermal selalu butuh konfirmasi pemilihan port.
- Tombol **ESC/POS** di detail transaksi mengunduh file biner yang bisa dikirim langsung ke printer.

---

## Gambar & Penyimpanan

- File upload disimpan di `storage/app/public/` (`products/` untuk foto produk, `store/` untuk logo).
- `php artisan storage:link` membuat `public/storage → storage/app/public`.
- Foto produk memakai URL absolut dari `APP_URL`; logo toko memakai path relatif `/storage/...`.
- Jika domain berubah, jalankan `php artisan config:clear` dan perbarui `APP_URL`.

---

## Struktur Proyek

```text
app/
├── Http/Controllers/Api/   # Endpoint REST (Auth, Product, Sale, Stock, Setting, User, ...)
├── Http/Middleware/        # Middleware `admin`
├── Models/                 # User, Product, Category, Sale, StockMovement, Setting, ...
└── Services/               # SettingService, ReceiptService
database/
├── migrations/             # Skema tabel + soft delete users
└── seeders/                # Data awal toko
resources/js/src/
├── components/             # Layout, Modal, DataTable, Field, Receipt, ...
├── lib/                    # api, auth, query, format, toast
├── pages/                  # Dashboard, Pos, Products, Stock, Sales, Settings, Users
├── App.tsx                 # Routing SPA + guard auth/admin
└── styles.css
routes/
├── api.php                 # Rute /api
└── web.php                 # Fallback ke SPA
public/                     # Document root + hasil build Vite
storage/app/public/         # File upload
```

---

## Perintah Umum

| Perintah | Fungsi |
| --- | --- |
| `composer install` | Install dependency PHP |
| `npm install` | Install dependency JS |
| `php artisan migrate` | Jalankan migrasi database |
| `php artisan db:seed` | Isi data awal |
| `php artisan storage:link` | Buat symlink storage |
| `npm run dev` | Vite dev server + HMR |
| `npm run build` | Build aset ke `public/build` |
| `npm run typecheck` | Cek TypeScript |
| `php artisan test` | Jalankan tes PHP |
| `composer dev` | Jalankan server, queue, log, dan Vite sekaligus |
| `php artisan config:clear` | Hapus cache konfigurasi |

---

## Referensi Endpoint

Semua rute diawali `/api`. Rute dengan 🔒 memerlukan token Bearer; 🔒👑 khusus admin.

| Grup | Endpoint |
| --- | --- |
| Publik | `POST /login`, `GET /settings/brand` |
| Auth | `POST /logout`, `GET /me` |
| Dashboard | `GET /dashboard` |
| Katalog | `GET /products`, `GET /products/{id}`, `GET /categories` |
| Stok | `GET /stock/low`, `GET /stock/movements` |
| Penjualan | `GET /sales`, `GET /sales/{id}`, `POST /sales`, `GET /sales/{id}/raw` |
| Struk | `POST /receipt/preview`, `POST /receipt/test` |
| Admin | `POST/PUT/DELETE /products`, `/categories`, `POST /stock/movements`, `PUT /settings`, `POST /settings/logo`, `POST /sales/{id}/void`, `GET/POST/PUT/DELETE /users` |

Token disimpan di `localStorage` dengan kunci `kopipos.token` dan dikirim sebagai header `Authorization: Bearer <token>`.

---

## Pemecahan Masalah

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| Foto produk / logo tidak tampil | `public/storage` bukan symlink | Hapus folder kosong itu, jalankan `php artisan storage:link` |
| Gambar 404 setelah pindah domain | `APP_URL` lama | Update `APP_URL`, jalankan `php artisan config:clear`, build ulang |
| Halaman putih / aset 404 | Aset belum di-build | `npm run build` |
| API 401 setelah login | Token expired / beda browser | Logout lalu login ulang |
| Gagal hapus user dengan transaksi | Foreign key `sales.user_id` | Sudah ditangani dengan soft delete; jalankan migrasi terbaru |
| Printer thermal tidak terdeteksi | Web Serial butuh secure context | Pakai Chrome/Edge di `localhost` atau HTTPS, pilih port saat diminta |
| Error 500 setelah ubah `.env` | Cache konfigurasi | `php artisan config:cache` ulang atau `php artisan config:clear` |

---

## Catatan Produksi

- Set `APP_ENV=production`, `APP_DEBUG=false`, dan `APP_URL` sesuai domain final.
- Ganti semua password bawaan seeder.
- Jalankan `npm run build`, lalu `php artisan config:cache && php artisan route:cache`.
- Pastikan folder `storage/` dan `bootstrap/cache/` bisa ditulis oleh web server, tetapi **jangan** diekspos ke publik selain lewat symlink `public/storage`.
- Lakukan backup database dan folder `storage/app/public` secara berkala.

---

## Lisensi

Proyek ini dibangun di atas Laravel yang berlisensi [MIT](https://opensource.org/licenses/MIT).

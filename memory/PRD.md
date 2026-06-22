# PRD — Alyssa Driver Checkpoint (v2.0)

## Original Problem Statement
Halaman driver-facing untuk PT Alyssa Auto Logistik. Driver borongan (mayoritas tua/gaptek) buka link dari WA admin, isi nama, baca SOP, upload 6 foto awal kendaraan (4 sisi + spidometer + jarum BBM), checkpoint harian (1 foto/hari = bonus Rp 30.000), serah terima akhir (BASTK PDF max 6 lembar + foto Resi), pencairan uang jalan 3 tahap.

**PIVOT** dari versi 1 (live GPS tracking) karena driver borongan tidak kooperatif untuk tracking real-time.

## User Choices (Confirmed)
- Halaman driver only — PO Admin tetap di PHP existing user
- Identifikasi via URL param (`?trip=...&driver=...&route=...&nopol=...&uj=...&t1=...&t2=...&t3=...`) + input nama (no password)
- Penyimpanan foto lokal di backend filesystem (`/app/backend/uploads/`)
- Pencairan via mock (admin transfer manual), bukan Xendit otomatis
- UI Bahasa Indonesia, tema dark premium (warna brand: gold #BA7517)

## Architecture
- Backend: FastAPI di port 8001, MongoDB via motor. Routes:
  - `GET /api/`, `POST /api/trips/init` (idempotent), `GET /api/trips/{id}`
  - `POST /api/trips/{id}/driver-name`, `POST /api/trips/{id}/sop-read`
  - `POST /api/trips/{id}/photos/initial` (multipart, slot=depan|belakang|kiri|kanan|spidometer|bbm)
  - `POST /api/trips/{id}/photos/daily` (1x per hari WIB, 409 jika duplikat)
  - `DELETE /api/trips/{id}/daily/today` (tester reset)
  - `POST /api/trips/{id}/photos/handover-bastk` (max 6), `POST /api/trips/{id}/photos/handover-resi`
  - `POST /api/trips/{id}/cair` ({tahap: 1|2|3}) — dengan gate: T1 butuh 6 initial, T3 butuh BASTK+Resi
  - Static mount `/api/uploads/*` untuk serve gambar/PDF
- Frontend: React 19 + CRA/Craco. Single page `DriverCheckpoint.jsx` di `/`.
- Storage: lokal `/app/backend/uploads/<trip_id>/{initial,daily,handover}/...`

## Implemented (2026-06-22)
- Real-time clock Indonesia (jam:menit:detik, Senin DD Bulan YYYY)
- Trip banner: NoPol besar (font mono), rute, greeting driver
- Input nama (sekali, persistent ke MongoDB)
- Modal SOP 10 poin + tombol "Saya Mengerti & Setuju"
- Grid 6 foto awal dengan camera capture (HTML5 `capture="environment"`)
- Auto-cair Tahap 1 setelah 6 foto awal selesai
- Daily checkpoint: tombol bulat besar "BELUM HARI INI"/"SUDAH HARI INI ✅", counter foto, total bonus, alert ok/info, tombol Reset (tester)
- Bonus Kerajinan Rp 150.000 card
- 3 Tahap Pencairan: Tahap 1 (50%/saat mulai), Tahap 2 (30%/tengah jalan), Tahap 3 (20%+bonus/saat tiba)
- Serah terima akhir: BASTK max 6 lembar (PDF/foto), Foto Resi
- Tombol "Kirim Lokasi ke Admin via WA" → wa.me deeplink
- Premium dark theme: gold gradient, glow effects, mobile-first ≤560px

## Testing Status
- Backend: 18/18 pytest pass (`/app/backend/tests/test_driver_checkpoint.py`)
- Frontend: ~95% UI flow verified (all data-testids, clock, modal, photo grid, cair card, handover, dark theme)
- Fixed: leading "." typo on driver greeting

## Backlog (P1/P2)
- P1: Server-returned `today` date (WIB) supaya frontend & backend selalu sync untuk gate "todayDone"
- P1: Backend file-size enforcement (sekarang cuma frontend)
- P1: Split `DriverCheckpoint.jsx` ke komponen kecil (TahapCard, SOPModal, PhotoSlot, dll)
- P2: Integrasi Xendit untuk pencairan otomatis
- P2: Admin view (read-only) untuk monitor semua trip dari React (atau extend PO Admin PHP)
- P2: Push notification reminder jam 06.00 untuk foto harian
- P2: Geofence detection pasif (untuk Tahap 2 "tengah jalan" otomatis kalau GPS terdeteksi di luar kota asal)

## Personas
- **Driver borongan**: 40-65 tahun, mayoritas Android low-end, koneksi 3G-4G, gaptek. UI harus 1-tap, font besar, label jelas, jangan ada navigation rumit.
- **Admin AAL**: existing PHP user; copy link checkpoint dari PO Admin → kirim WA ke driver.

## Next Action Items
- Konfirmasi user untuk feedback visual & flow
- Kalau OK: deploy ke production & integrasikan link dari PHP PO Admin
- Implementasi Xendit kalau user mau pencairan auto

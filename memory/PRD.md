# PRD — Alyssa Driver Checkpoint (v2.1)

## Original Problem Statement
Halaman driver-facing untuk PT Alyssa Auto Logistik. Driver borongan (mayoritas tua/gaptek) buka link dari WA admin, isi nama, baca SOP, upload 6 foto awal kendaraan (4 sisi + spidometer + jarum BBM), checkpoint harian (1 foto/hari = bonus Rp 30.000), serah terima akhir (BASTK PDF max 6 lembar + foto Resi), pencairan uang jalan 3 tahap.

**PIVOT** dari v1 (live GPS tracking) → v2 (driver checkpoint sederhana). **v2.1** menambahkan integrasi struktur data PO Admin existing (PHP) + Odoo webhook hook + Xendit stub MOCKED.

## User Choices (Confirmed)
- Halaman driver only — PO Admin tetap di PHP existing user (1a)
- Identifikasi via URL param + input nama (2a default)
- Penyimpanan foto lokal `/app/backend/uploads/` (5a)
- Pencairan via mock + Xendit stub (legalitas dalam proses) (4a → 3a)
- Odoo: webhook event dispatcher saat handover complete + saat cair (2a+b)
- Tambah field tipe_kendaraan, no_rangka, legs[] supaya match struktur PO Admin PHP (4a)

## Architecture
- Backend: FastAPI di port 8001, MongoDB via motor. Routes:
  - `GET /api/`, `POST /api/trips/init` (idempotent), `GET /api/trips/{id}`
  - `POST /api/trips/{id}/driver-name`, `POST /api/trips/{id}/sop-read`
  - `POST /api/trips/{id}/photos/initial` (multipart, slot=depan|belakang|kiri|kanan|spidometer|bbm)
  - `POST /api/trips/{id}/photos/daily` (1x per hari WIB)
  - `DELETE /api/trips/{id}/daily/today`
  - `POST /api/trips/{id}/photos/handover-bastk` (max 6)
  - `POST /api/trips/{id}/photos/handover-resi`
  - `POST /api/trips/{id}/cair` ({tahap: 1|2|3}) dengan gate
  - **`POST /api/trips/{id}/xendit/disburse` {tahap} — MOCKED (legalitas pending)**
  - Static mount `/api/uploads/*`
- Frontend: React 19 + CRA/Craco. Single page `DriverCheckpoint.jsx` di `/`.
- Storage foto: `/app/backend/uploads/<trip_id>/{initial,daily,handover}/...`
- **Odoo Webhook**: env `ODOO_WEBHOOK_URL` (optional). Fire-and-forget POST saat:
  - `trip.initial_complete` (setelah 6 foto awal + auto T1 cair)
  - `trip.handover_complete` (setelah BASTK + Resi keduanya ada)
  - `trip.cair` (saat tiap tahap cair)
  - Kalau env kosong → no-op (logger info only)
- **Xendit (MOCKED)**: endpoint stub yang persist `xendit.tN.id/status/ts`. Saat legalitas selesai, tinggal ganti isi function dengan call ke Xendit SDK — UI tidak perlu diubah.

## Trip Document Schema
```js
{
  trip_id, driver_id, nopol, route, uj, t1, t2, t3,
  tipe_kendaraan, no_rangka,
  legs: [{ jalur, asal, tujuan, kapal, harga, status }],
  bonus_daily, bonus_kerajinan,
  nama_driver, sop_read,
  initial_photos: { depan, belakang, kiri, kanan, spidometer, bbm },
  daily_checkpoints: [{ id, date, url, ts }],
  handover: { bastk: [{id, url, ts}], resi: {url, ts} },
  cair: { "1": bool, "2": bool, "3": bool },
  xendit: { t1: {id, status, ts}, t2: {...}, t3: {...} },
  odoo_synced: { handover, cair_1, cair_2, cair_3 },
  created_at, updated_at
}
```

## Implemented (2026-06-22)
**v2.0 (sebelumnya):**
- Real-time clock Indonesia
- Trip banner (NoPol mono font), greeting driver
- Input nama (persistent), modal SOP 10 poin
- Grid 6 foto awal dengan camera capture, auto-cair T1
- Daily checkpoint button bulat besar dengan counter, bonus, alert
- 3 Tahap pencairan dengan gate
- Handover BASTK (max 6) + Resi
- WA deeplink ke admin
- Premium dark theme mobile-first

**v2.1 (sekarang):**
- Tipe kendaraan + No Rangka di banner trip
- Section "Rute Pengiriman" menampilkan legs dengan jalur pill (Self Drive/Kapal Laut/dst), asal→tujuan, vendor, status pill
- Odoo webhook dispatcher (fire-and-forget, configurable via ODOO_WEBHOOK_URL)
- Xendit MOCKED endpoint dengan persisted disbursement state
- odoo_synced flags untuk idempotency (handover, cair_1/2/3)

## Testing Status
- Backend: **25/25 pytest pass** (`/app/backend/tests/test_driver_checkpoint.py`)
  - 18 regression (init idempotent, name, SOP, foto upload, daily dedup, BASTK cap, cair gates, static)
  - 7 new (tipe/rangka/legs, Xendit MOCKED happy path, Xendit invalid tahap/404, Odoo no-op safety, odoo_synced.handover idempotent, odoo_synced.cair_N)
- Frontend: **4/4 scenarios pass** (banner tipe/rangka, legs card render, status pill colors, no-legs case)
- Zero blocking issues. Mock APIs: 1 (Xendit disburse).

## Integration Guide untuk Admin PHP

**1. Update tombol "Kirim CP" di PO Admin PHP:**
Ubah URL link checkpoint dari `https://alyssalogistik.co.id/driver-checkpoint.php?...` menjadi preview/production URL React app. Tambah param baru:
```
?trip=TRIP-{po_id}-{unit_id}
&driver=DRV-{unit_id}
&nopol={u.nopol}
&route={asal} - {tujuan}
&tipe={u.tipe}
&rangka={u.rangka}
&uj={u.uang_jalan}&t1={u.t1}&t2={u.t2}&t3={u.t3}
&legs={encodeURIComponent(JSON.stringify(u.legs))}
```

**2. Aktifkan Odoo webhook (opsional):**
Set `ODOO_WEBHOOK_URL=https://alyssalogistik.co.id/odoo-proxy.php` di `/app/backend/.env`. Backend akan POST event ke endpoint itu dengan body `{event, data, ts}`.
Event yang dikirim: `trip.initial_complete`, `trip.handover_complete`, `trip.cair`.

**3. Saat Xendit legalitas selesai:**
Edit `xendit_disburse()` di `server.py` — ganti mock dengan call ke Xendit SDK (`xendit_python.disbursement.create(...)`). UI driver tidak perlu diubah.

## Backlog (P1/P2)
- P1: Server-returned `today` date (WIB) untuk gate "todayDone" konsisten lintas timezone
- P1: Backend file-size enforcement (server-side)
- P1: Split DriverCheckpoint.jsx ke sub-komponen (TahapCard, LegsList, HandoverSection, SOPModal)
- P1: Schema Pydantic untuk `Leg` (saat ini List[Dict[str, Any]])
- P2: WhatsApp auto-reminder jam 06.00 (Fonnte/Twilio)
- P2: Push notif
- P2: Real Xendit integration (saat legalitas done)
- P2: Geofence pasif untuk auto-trigger T2

## Personas
- **Driver borongan**: 40-65 tahun, Android low-end, koneksi 3G-4G, gaptek. UI 1-tap, font besar.
- **Admin AAL**: pakai PO Admin PHP existing, copy link checkpoint dari React app ke WA driver.

## Next Action Items
- User update tombol "Kirim CP" di PO Admin PHP supaya link ke React app + push field baru via param
- User set `ODOO_WEBHOOK_URL` di backend/.env kalau mau Odoo auto-sync
- Saat Xendit legalitas selesai → edit `xendit_disburse()` (sudah dipisahkan untuk drop-in replacement)

# PRD — Alyssa Driver Checkpoint (v2.2)

## Original Problem Statement
Sistem kontrol driver borongan + tracking pengiriman untuk PT Alyssa Auto Logistik. Pelanggan (rental, dealer, kontraktor) dapat link tracking untuk lihat progres. Driver (mayoritas tua/gaptek) dapat link via WA: isi nama, baca SOP, upload foto per tahap (Asal/Dalam Kapal/Tujuan/Dokumen) + foto wajib awal + foto harian (bonus Rp 30k jepret) + serah terima akhir (BASTK+Resi). Pencairan uang jalan 3 tahap (Xendit MOCKED — legalitas dalam proses).

## User Choices
- v2.0: halaman driver only, URL param + nama, MongoDB storage, mock cair
- v2.1: + sync field PO Admin (tipe, rangka, legs), Odoo webhook, Xendit stub
- **v2.2** (sekarang): + album foto 4 tahap (mirror PO Admin PHP) + halaman customer tracking

## Architecture
- Backend: FastAPI di port 8001, MongoDB via motor. Routes utama:
  - `POST /api/trips/init` (idempotent, backfill album), `GET /api/trips/{id}`, `GET /api/public/trips/{id}` (sanitized)
  - `POST /api/trips/{id}/driver-name`, `POST /api/trips/{id}/sop-read`
  - `POST /api/trips/{id}/photos/initial` (6 slot wajib)
  - `POST /api/trips/{id}/photos/daily` (bonus Rp 30k/foto, 1 per hari)
  - `POST /api/trips/{id}/album` (form: stage, foto, catatan, uploaded_by) — PDF hanya stage='dokumen'
  - `DELETE /api/trips/{id}/album/{stage}/{photo_id}`
  - `POST /api/trips/{id}/photos/handover-bastk` (max 6), `POST /api/trips/{id}/photos/handover-resi`
  - `POST /api/trips/{id}/cair` (gate per tahap)
  - `POST /api/trips/{id}/xendit/disburse` — MOCKED stub
  - Static mount `/api/uploads/*`
- Frontend (React 19 + Craco): 2 pages routed by query param:
  - `/?trip=...` → **DriverCheckpoint** (driver upload UI)
  - `/?track=...` → **CustomerTracking** (read-only, auto-refresh 30s)
- Storage foto: `/app/backend/uploads/<trip_id>/{initial,daily,handover,album}/...`
- Odoo Webhook (optional env `ODOO_WEBHOOK_URL`): fire-and-forget event saat initial complete / handover complete / cair.

## Trip Document Schema (v2.2)
```js
{
  trip_id, driver_id, nopol, route, uj, t1, t2, t3,
  tipe_kendaraan, no_rangka,
  legs: [{ jalur, asal, tujuan, kapal, harga, status }],
  bonus_daily, bonus_kerajinan,
  nama_driver, sop_read,
  initial_photos: { depan, belakang, kiri, kanan, spidometer, bbm },
  daily_checkpoints: [{ id, date, url, ts }],
  album: { asal: [], kapal: [], tujuan: [], dokumen: [] },  // ← NEW
  handover: { bastk: [{id, url, ts}], resi: {url, ts} },
  cair: { "1": bool, "2": bool, "3": bool },
  xendit: { t1: {id, status, ts}, t2: {...}, t3: {...} },
  odoo_synced: { handover, cair_1, cair_2, cair_3 },
  created_at, updated_at
}
```

## Public Tracking Endpoint (Customer-Safe Fields)
`GET /api/public/trips/{id}` returns only: `trip_id, nopol, tipe_kendaraan, no_rangka, route, nama_driver, legs, album, handover, daily_count, initial_done, progress{initial_complete, handover_complete}, created_at, updated_at`. **Hidden**: xendit, odoo_synced, cair, sop_read, t1/t2/t3 amounts, bonus values, driver_id.

## Implemented Features (Cumulative)
**v2.0/2.1:**
- Driver UI: real-time clock, banner (NoPol+tipe+rangka+route), input nama, SOP modal, 6 foto awal (auto-cair T1), daily checkpoint dengan bonus, 3 tahap pencairan dengan gate, handover BASTK+Resi, WA share, premium dark theme mobile.
- Backend: idempotent init, photo upload, daily dedup per WIB, cair gates, static serving, Odoo webhook (configurable env), Xendit MOCKED stub.

**v2.2 (new):**
- **Album 4 tahap** (Asal/Dalam Kapal/Tujuan/Dokumen) di driver page dengan tab UI + multi-upload + delete; Dokumen unik menerima PDF.
- **Halaman Customer Tracking** read-only di `?track=<trip_id>` dengan: progress overview, rute legs, album 4-tab, dokumen serah terima (BASTK+Resi), overall status auto-derived (Persiapan / Siap Berangkat / Sedang Dikirim / Tiba di Tujuan / Sudah Diterima), auto-refresh 30 detik.
- Routing client-side via query param tanpa react-router (lightweight).
- Backfill `album` field saat init untuk trip lama (non-breaking migration).

## Testing Status
- Backend: **37/37 pytest pass** (25 regression + 12 baru: album CRUD, PDF rule per stage, public tracking sanitization, backfill)
- Frontend: 3/3 scenarios pass (album tabs driver, customer tracking page, routing)
- Cosmetic fixes applied: footer label, progress tile font scaling
- Mock APIs: 1 (Xendit MOCKED disburse — sesuai pilihan user)

## Integrasi ke PO Admin PHP

**1. Tombol "Kirim CP" driver — URL link ke driver page:**
```
{REACT_APP_URL}/?trip=TRIP-{po_id}-{unit_id}&nopol={u.nopol}&tipe={u.tipe}
&rangka={u.rangka}&route={asal}-{tujuan}
&uj={uj}&t1={t1}&t2={t2}&t3={t3}
&legs={encodeURIComponent(JSON.stringify(u.legs))}
```

**2. Tombol "Copy Link" customer — URL tracking:**
```
{REACT_APP_URL}/?track=TRIP-{po_id}-{unit_id}
```

**3. (Opsional) Aktifkan Odoo webhook:**
Set `ODOO_WEBHOOK_URL=https://alyssalogistik.co.id/odoo-proxy.php` di backend `.env`.

**4. Saat Xendit legalitas done:**
Edit `xendit_disburse()` di server.py — ganti mock dengan call Xendit SDK. UI driver tidak berubah.

## Backlog (P1/P2)
- P1: Split DriverCheckpoint.jsx ke sub-komponen (Album, Handover, TahapCard, SOPModal)
- P1: Schema Pydantic untuk Leg
- P1: Backend max upload-size enforcement
- P1: Shared util module untuk ALBUM_STAGES/stageLabel/stageIcon (saat ini duplicated di Driver & Customer pages)
- P2: Form pesanan customer (4-step wizard: Kendaraan/Asal/Tujuan/Konfirmasi) → submit ke FastAPI + relay ke PHP po-data.php
- P2: Admin mini-dashboard React (lihat semua trip aktif, resend WA, trigger Xendit, export CSV)
- P2: Real Xendit integration saat legalitas done
- P2: WhatsApp auto-reminder (Fonnte) jam 06.00 untuk foto harian
- P2: Server-side `today` (WIB) untuk gate harian konsisten lintas timezone

## Personas
- **Driver borongan** (40-65 tahun, Android low-end, gaptek): UI 1-tap, font besar, label jelas, bonus per jepret biar semangat.
- **Admin AAL**: PO Admin PHP existing, share link driver + link customer via WA.
- **Pelanggan rental/dealer/kontraktor**: buka link tracking, lihat progres real-time, download BASTK+Resi untuk tagihan/serah terima mereka sendiri.

## Next Action Items
- User update PO Admin PHP tombol "Kirim CP" + tambah tombol "Copy Link Customer"
- Setup Odoo webhook URL (opsional)
- Iterasi berikutnya: form pesanan customer + admin mini-dashboard

# PRD — Alyssa Driver Checkpoint (v2.3)

## Original Problem Statement
Sistem kontrol driver borongan + tracking pengiriman PT Alyssa Auto Logistik. Pelanggan rental/dealer/kontraktor butuh BASTK+Resi sendiri untuk tagihan. Driver borongan tua/gaptek dapat link via WA, isi nama, baca SOP, foto unit, daily checkpoint (bonus Rp 30k/jepret via Xendit), serah terima.

## User Choices (Cumulative)
- v2.0: halaman driver only, URL param, MongoDB, mock cair
- v2.1: + sync tipe/rangka/legs PO Admin, Odoo webhook, Xendit stub
- v2.2: + album foto 4 tahap (Asal/Dalam Kapal/Tujuan/Dokumen), halaman customer tracking read-only
- **v2.3 (now)**: redesign UI premium match screenshot user existing — 5 slot foto (drop bbm), full-screen NameStep + SOPStep forced sequential flow, logo bendera golf SVG, 7-poin SOP "WAJIB BACA SEBELUM JALAN", box DARURAT gold

## Architecture
- Backend FastAPI port 8001, MongoDB motor. Static `/api/uploads/*`.
- Frontend React 19 + Craco. Routes by query param:
  - `/?trip=...` → DriverCheckpoint (3-step forced flow)
  - `/?track=...` → CustomerTracking (read-only, auto-refresh 30s)
- Storage `/app/backend/uploads/<trip_id>/{initial,daily,handover,album}/...`
- Odoo webhook optional env `ODOO_WEBHOOK_URL`
- Xendit MOCKED stub (drop-in replacement saat legalitas done)

## Driver Flow (v2.3 enforced sequence)
1. **NameStep** (full-screen): logo bendera golf SVG, brand ALYSSA LOGISTIK, "Halo Driver! 👋", input nama lengkap KTP, tombol hijau "Lanjut →", footer "Data rekening akan diisi oleh admin", pill UNIT NoPol. Enter-key submit. Empty → toast error.
2. **SOPStep** (full-screen, FORCED — no skip/close): banner merah "⚠️ WAJIB BACA SEBELUM JALAN! · 7 PERINTAH DRIVER ALYSSA", 7 poin (CEK FISIK / FOTO UNIT / UPDATE FOTO JALUR / ATURAN KABIN / PENAMPILAN / ATURAN FINISH / DOKUMEN AMAN) dengan numbered green circle, box DARURAT gold "🚨 Hubungi admin: 0818 631 135", tombol dashed "🤚 Saya Sudah Baca & Setuju".
3. **MainDashboard**: trip banner (NoPol+tipe+rangka+route+greet), rute legs, SOP card "✓ Sudah Dibaca" + Baca Ulang, **5 foto awal wajib** (depan/belakang/kiri/kanan/spidometer — drop BBM, dashboard menampilkan keduanya), album 4 tahap (Asal/Dalam Kapal/Tujuan/Dokumen, PDF only di Dokumen), daily checkpoint (gated allInitialDone), 3 tahap pencairan (T1 auto saat 5 foto, T2 manual, T3 setelah BASTK+Resi), handover BASTK+Resi.

## Customer Flow
- Admin share `/?track=TRIP-...` ke pelanggan via WA.
- Read-only page: status overall (Persiapan/Siap Berangkat/Sedang Dikirim/Tiba/Diterima), progress tiles, rute legs, album 4-tab, berkas serah terima (BASTK+Resi terpisah).
- Field sensitif (xendit, t1/t2/t3, bonus, cair, driver_id, odoo_synced, sop_read) **TIDAK** ter-expose.

## Trip Document Schema (v2.3)
```js
{
  trip_id, driver_id, nopol, route, uj, t1, t2, t3,
  tipe_kendaraan, no_rangka,
  legs: [{ jalur, asal, tujuan, kapal, harga, status }],
  bonus_daily (30000), bonus_kerajinan (150000),
  nama_driver, sop_read,
  initial_photos: { depan, belakang, kiri, kanan, spidometer },  // 5 slots (was 6)
  daily_checkpoints: [{ id, date, url, ts }],
  album: { asal: [], kapal: [], tujuan: [], dokumen: [] },
  handover: { bastk: [{id, url, ts}], resi: {url, ts} },
  cair: { "1": bool, "2": bool, "3": bool },
  xendit: { t1: {id, status, ts}, t2: {...}, t3: {...} },
  odoo_synced: { handover, cair_1, cair_2, cair_3 },
  created_at, updated_at
}
```

## API (Cumulative)
- `GET /api/`, `POST /api/trips/init` (idempotent + backfill album), `GET /api/trips/{id}`, `GET /api/public/trips/{id}` (sanitized)
- `POST /api/trips/{id}/driver-name`, `POST /api/trips/{id}/sop-read`
- `POST /api/trips/{id}/photos/initial` (slot ∈ {depan,belakang,kiri,kanan,spidometer})
- `POST /api/trips/{id}/photos/daily`, `DELETE /api/trips/{id}/daily/today`
- `POST /api/trips/{id}/album` (multipart: stage, foto, catatan, uploaded_by; PDF hanya stage=dokumen)
- `DELETE /api/trips/{id}/album/{stage}/{photo_id}`
- `POST /api/trips/{id}/photos/handover-bastk` (max 6), `POST /api/trips/{id}/photos/handover-resi`
- `POST /api/trips/{id}/cair` (gate: T1 need 5 initial, T3 need BASTK+Resi)
- `POST /api/trips/{id}/xendit/disburse` — MOCKED stub

## Testing Status
- Backend: **42/42 pytest pass** (37 regression + 5 v2.3 baru: bbm rejection, 5-slot cair gate, public progress)
- Frontend: 3/3 step-by-step flows verified (NameStep, SOPStep forced, Dashboard + Baca Ulang modal)
- All copy "6 foto" → "5 foto" fixed
- Visual contrast OK (white-on-red banner, white-on-dark cards)

## Integration ke PO Admin PHP existing
**Link driver (tombol "Kirim CP"):**
```
{REACT_URL}/?trip=TRIP-{po}-{unit}&nopol=...&tipe=...&rangka=...
&route={asal}-{tujuan}&uj=...&t1=...&t2=...&t3=...
&legs={encodeURIComponent(JSON.stringify(u.legs))}
```
**Link customer (tombol "Copy Link Tracking"):**
```
{REACT_URL}/?track=TRIP-{po}-{unit}
```

## Backlog (P1/P2)
- P1: Split DriverCheckpoint.jsx (~800 lines) → NameStep.jsx + SOPStep.jsx + AAlyssaLogo.jsx + Dashboard subkomponen
- P1: Backend max upload-size enforcement
- P1: Shared util module untuk ALBUM_STAGES/stageLabel/stageIcon
- P2: Real Xendit integration saat legalitas done (drop-in replace `xendit_disburse()`)
- P2: WhatsApp auto-reminder jam 06.00 (Fonnte murah untuk lokal Indo)
- P2: Form pesanan customer 4-step
- P2: Admin mini-dashboard React (list trip aktif, resend WA, trigger Xendit, export CSV)
- P2: Email subscribe untuk customer tracking (SendGrid/Resend)

## Next Action Items
- User update PO Admin PHP: tombol "Kirim CP" ke `/?trip=...` + tombol baru "Copy Link Tracking" ke `/?track=...`
- (Opsional) set `ODOO_WEBHOOK_URL` di backend .env
- Saat Xendit legalitas done → edit `xendit_disburse()` di server.py

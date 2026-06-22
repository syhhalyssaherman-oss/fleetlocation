# PRD — Alyssa Driver Checkpoint (v2.4)

## Original Problem Statement
Sistem kontrol driver borongan + tracking pengiriman PT Alyssa Auto Logistik. Pelanggan rental/dealer/kontraktor butuh BASTK+Resi sendiri untuk tagihan. Driver borongan tua/gaptek dapat link via WA, isi nama, baca SOP, foto unit, daily checkpoint (bonus Rp 30k/jepret via Xendit), serah terima.

## v2.4 Focus (Stable & Deploy-Ready)
- **Retheme Navy + Gold** (premium feel)
- **Proof of Delivery card** premium di driver & customer page
- **Integration snippet PHP** untuk admin existing (Copy Link Tracking + Kirim CP redirect)
- **NO database schema change** — hanya tambah optional `lat`/`lng` di daily_checkpoints (additive, backward compat)
- **NO new features** beyond PoD card — fokus stabil

## User Choices (Cumulative)
- v2.0: halaman driver only, URL param, MongoDB, mock cair
- v2.1: + sync tipe/rangka/legs PO Admin, Odoo webhook, Xendit stub
- v2.2: + album foto 4 tahap, halaman customer tracking
- v2.3: + redesign UI premium (logo bendera golf, NameStep + SOPStep forced, 5 slot foto)
- **v2.4 (now): retheme navy+gold + PoD card + admin PHP integration doc**

## Architecture
- Backend FastAPI port 8001, MongoDB motor. Static `/api/uploads/*`.
- Frontend React 19 + Craco. Routes:
  - `/?trip=...` → DriverCheckpoint (NameStep → SOPStep → Dashboard)
  - `/?track=...` → CustomerTracking (read-only, auto-refresh 30s)
- Theme: navy palette `--bg #0A1628`, `--bg-2 #0F1E35`, `--surface #152238` + gold `--gold #BA7517`, `--gold-light #D4A847`
- Storage `/app/backend/uploads/<trip_id>/{initial,daily,handover,album}/...`
- Odoo webhook optional env `ODOO_WEBHOOK_URL`
- Xendit MOCKED stub (drop-in replace saat legalitas done)

## Proof of Delivery Card (v2.4 NEW)
Per daily checkpoint, tampilkan card premium dengan:
- 📸 **Foto kendaraan** besar (aspect 4:3, object-cover) dengan badge CP-N gold
- 🗺️ **Mini Leaflet map 160px** dengan marker merah pulsing (kalau ada lat/lng) atau placeholder "Lokasi GPS tidak dicatat"
- 👤 Nama driver
- 🚗 No. Polisi (font monospace gold)
- 📅 Tanggal **dd-mm-yyyy**
- 🕒 Jam **HH.MM WIB** (format Indonesia)
- 🗺️ Koordinat + link "Buka Google Maps" (deeplink)

Tampil di:
- **Driver page**: section `data-testid="pod-card-list"` setelah daily checkpoint button
- **Customer tracking**: section `data-testid="trk-pod-list"` antara progress dan album

GPS capture: best-effort di driver page saat upload daily — `navigator.geolocation.getCurrentPosition()` dengan timeout 5s. Kalau gagal/denied, upload tanpa GPS (tetap dihitung valid).

## Trip Document Schema (v2.4)
**NO BREAKING CHANGE**. Hanya tambah optional `lat`/`lng` di entry `daily_checkpoints`:
```js
daily_checkpoints: [
  { id, date, url, ts, lat?, lng? },  // ← lat/lng optional (v2.4+)
]
```
Field lain identik dengan v2.3.

## API (v2.4 changes)
- `POST /api/trips/{id}/photos/daily` — sekarang terima optional Form fields `lat: float?` dan `lng: float?`
- `GET /api/public/trips/{id}` — sekarang return `daily_checkpoints` (array lengkap) di samping `daily_count`
- Semua endpoint lain tidak berubah

## Testing Status
- Backend: **49/49 pytest pass** (42 regression + 7 v2.4 baru: version v2.4, lat/lng optional, public daily_checkpoints, backward-compat no-GPS, seed, integration doc)
- Frontend: **100% verified** (PoDCard render, mini map, GPS marker, dd-mm-yyyy, HH.MM WIB, Google Maps link, no-GPS placeholder, /5 fix, navy+gold theme contrast OK)
- Mock APIs: 1 (Xendit MOCKED disburse)
- No critical/minor issues; 1 design note (time uses "." separator standard Indonesia)

## Integration Doc untuk Admin PHP (v2.4 deliverable)
File `/app/INTEGRATION_PO_ADMIN_PHP.md` berisi 5 snippet siap copy-paste:
1. Konstanta `REACT_APP_URL`
2. Replacement `kirimLinkCheckpoint()` — link ke React app + push tipe/rangka/legs
3. **BARU**: `copyLinkTracking()` + tombol "📦 Copy Link Tracking" untuk share ke pelanggan
4. Aktivasi Odoo webhook env
5. Xendit drop-in replacement saat legalitas done

## Backlog (P1/P2)
- P1: Split DriverCheckpoint.jsx (~800 lines) → NameStep.jsx + SOPStep.jsx + AAlyssaLogo.jsx
- P1: Split server.py upload handlers ke module terpisah
- P1: Backend max upload-size enforcement
- P2: Real Xendit integration saat legalitas done
- P2: WhatsApp auto-reminder jam 06.00 (Fonnte)
- P2: Form pesanan customer 4-step
- P2: Admin mini-dashboard React (lihat semua trip aktif, export CSV)

## Next Action Items
- User integrate snippet dari `/app/INTEGRATION_PO_ADMIN_PHP.md` ke `po-admin.php` existing
- Set `ODOO_WEBHOOK_URL` di backend `.env` (opsional)
- Deploy production
- Saat Xendit legalitas done → drop-in replace `xendit_disburse()`

# PRD — Fleet Driver Checkpoint Console

## Original Problem Statement
Tambahkan fitur peta lokasi interaktif (Live Map) dan form manifes perjalanan ke aplikasi:
1. Peta lokasi (Google Maps stub) untuk tracking posisi saat ini.
2. Jam, Tanggal, Bulan, Tahun real-time.
3. Input + display Nomor Polisi Mobil (No Pol).
4. Driver Checkpoint: catat & tampilkan titik pemeriksaan dengan timestamp saat tombol checkpoint ditekan.
Desain bersih, responsif, data langsung muncul di dashboard utama.

## User Choices (confirmed)
- Stack: React + FastAPI + MongoDB (existing)
- Map: Leaflet + OpenStreetMap (no API key)
- GPS source: `navigator.geolocation` (real device GPS)
- Storage: MongoDB via FastAPI
- Locale/UI Language: Indonesian

## Architecture
- Backend: FastAPI (port 8001), MongoDB (motor). Routes under `/api`:
  - `GET /api/` health
  - `POST /api/manifests`, `GET /api/manifests`, `GET /api/manifests/active`, `POST /api/manifests/{id}/complete`
  - `POST /api/checkpoints`, `GET /api/checkpoints?manifest_id=...`, `DELETE /api/checkpoints`
- Frontend: React 19 + CRA/Craco, react-leaflet 5, leaflet 1.9.
- Single-page dashboard at `/`. All data shown real-time on main screen.

## What's Been Implemented (2026-06-22)
- Real-time clock (jam:menit:detik + Senin, 22 Juni 2026 format, locale id-ID).
- Live Map with OpenStreetMap tiles, animated pulsing live-position marker, checkpoint markers, and dashed polyline connecting checkpoints.
- Auto fly-to on GPS update.
- Manifest form (No Pol, Nama Driver, Asal, Tujuan, Muatan) → POST to MongoDB; active manifest summary card with "Selesaikan Manifes" CTA.
- Nomor Polisi prominent display card (inverted dark style).
- "Tambah Checkpoint" CTA (Signal Red) — uses `navigator.geolocation` and persists checkpoint to MongoDB; instantly prepends to vertical timeline with timestamp + coords.
- Responsive 12-col grid (Map col-span 8 / Sidebar col-span 4 on desktop, stacked on mobile).
- Toast notifications for actions; GPS error banner fallback to Jakarta default.

## Testing Status
- Backend: 11/11 pytest cases pass (`/app/backend/tests/test_driver_checkpoint.py`).
- Frontend: 100% UI flow verified (clock ticks, map renders with 15 tiles, manifest form, checkpoint add increments count, persistence across reload).
- No mocked APIs.

## Personas
- Driver / Operator Logistik — needs single-screen console while in transit.
- Dispatcher (future) — review trip manifests + checkpoint history.

## Backlog (P1/P2)
- P1: Multi-driver / multi-manifest list view & history page.
- P1: Reverse-geocode checkpoint coords into readable address.
- P2: Auth (driver login) + role-based dashboards.
- P2: Export manifest+checkpoints to CSV/PDF.
- P2: Live broadcast over WebSocket so dispatcher map updates in real-time.
- P2: Geofence / route-deviation alerts.

## Next Action Items
- Add address resolution (Nominatim) for each checkpoint.
- Add dispatcher view listing all active manifests with mini-maps.
- Add driver auth (JWT) before going to production.

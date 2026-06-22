# PRD — Alyssa Driver Checkpoint (v2.6a complete)

## Current Status (Feb-2026)
**v2.6a SHIPPED**: BASTK (Berita Acara Serah Terima Kendaraan) Premium PDF Generator.
**Next**: v2.6b — Customer Order Form + Odoo SDK stub.

## Tech Stack
- React + Tailwind (custom theme Navy + Gold)
- FastAPI + Motor (Async MongoDB)
- Libraries: react-leaflet, jspdf, html2canvas, axios

## App Structure (3 routes)
```
/?trip=<trip_id>   → DriverCheckpoint  (driver-side, full lifecycle)
/?track=<trip_id>  → CustomerTracking  (read-only PoD)
/?bastk=<trip_id>  → BASTKPage         (premium PDF generator)
```

## v2.6a Features (NEW)
- **20 SVG vehicle sketches**: Sedan / MPV / SUV / Pickup / Double Cabin / CDD / Truck Box / Dump Truck / Tangki / Tronton / Box Besar / Canter / Canter Pemadam / Motor 2 Roda / Motor 3 Roda / Forklift / Excavator / Dozer / Grader / Vibro Roller.
- **Damage checklist hotspot**: 6 codes — RSK / B / P / PC / CL / L — click to add markers on sketch, click marker to remove.
- **Dual signature pad**: Driver + Customer, base64 PNG persisted in MongoDB (capped 400KB).
- **A4 print-ready PDF**: html2canvas → jsPDF, multi-page split, 2.5x scale for crisp print, filename `BASTK-<nopol>.pdf`.
- **Customer data form**: nama/HP/PIC/alamat/warna/tahun/km/kondisi, all whitelisted + truncated server-side.
- **Premium UI**: Navy + Gold print area with double-line gold border header, two-column data tables, embedded sketch panel, signature tri-grid, footer.

## v2.5 Features (DONE)
- Status enum on daily upload (Berangkat / CP1 / CP2 / CP3 / Tiba Tujuan)
- Keterangan optional (300 char)
- Reminder banner (06:00 WIB)
- PoD PDF download per checkpoint
- Status chip + keterangan box in PoD card

## DB Schema (additive, backward-compatible)
```js
trips: {
  trip_id, driver_id, nopol, route, uj, t1, t2, t3, bonus_daily, bonus_kerajinan,
  tipe_kendaraan, no_rangka, legs,
  nama_driver, sop_read,
  initial_photos: { ... },
  daily_checkpoints: [{ id, date, url, ts, lat?, lng?, status?, keterangan? }],
  album: { asal:[], kapal:[], tujuan:[], dokumen:[] },
  handover: { bastk:[], resi:null },
  cair: { 1, 2, 3 },
  xendit: { t1, t2, t3 },           // MOCKED
  odoo_synced: { handover, cair_1, cair_2, cair_3 },
  // v2.6a additive:
  vehicle_type?,                     // enum: 20 types
  damage_marks?: [{ id, code, x%, y%, note? }],
  customer_data?: { nama, hp, alamat, pic, warna, tahun, km, kondisi },
  signatures?: { driver?, customer?, admin?, ts_* },
  bastk_catatan?,
  created_at, updated_at,
}
```

## Testing Status
- **Backend**: **74/74 pytest pass** (49 base + 10 v2.5 + 14 v2.6a BASTK + 1 seed self-heal).
- **Frontend**: 100% — BASTK lifecycle (load → edit → save → reload persistence → PDF), regression on `/?trip=` and `/?track=` unbroken.
- **Mocked APIs**: Xendit (legalitas pending), Odoo webhook (no-op when ODOO_WEBHOOK_URL empty).

## Integration ke PO Admin PHP
File `/app/INTEGRATION_PO_ADMIN_PHP.md` valid — snippet untuk URL constant, `kirimLinkCheckpoint()`, `copyLinkTracking()`, Odoo webhook env, Xendit drop-in.

## Env (backend/.env)
```
MONGO_URL, DB_NAME, CORS_ORIGINS
ODOO_WEBHOOK_URL  # optional generic webhook (no-op when empty)
ODOO_URL, ODOO_DB, ODOO_USER, ODOO_KEY  # placeholders for v2.6b real SDK
```

## Pending v2.6b Roadmap (NEXT)
- **CustomerOrderForm.jsx** 4-step wizard di `/?order=1` (Kendaraan → Asal → Tujuan → Konfirmasi).
- **POST /api/orders** backend endpoint dengan validasi + Odoo webhook event `order.created`.
- **Odoo XML-RPC client** real (stub-ready) — pakai env `ODOO_URL/DB/USER/KEY`. Saat env empty → fallback ke notify_odoo no-op.
- **Auto-create BASTK** dari order pelanggan (bridge order → trip).

## Future / Backlog (P2)
- Real Xendit (legalitas done)
- Admin dashboard lokal (kalau perlu)
- "Clear all marks" button di BASTK editor (UX nice-to-have)
- Watermark logo di PDF
- Sketch zoom + pan untuk marker presisi
- BASTK email/WhatsApp share otomatis ke pelanggan

## Demo URLs (TRIP-POD-DEMO)
- Driver: `/?trip=TRIP-POD-DEMO`
- Customer: `/?track=TRIP-POD-DEMO`
- BASTK: `/?bastk=TRIP-POD-DEMO` (sudah seeded: Truck Box + 3 marks + customer Logistik Jaya)

# CHANGELOG — Alyssa Driver Checkpoint

## [v2.6b] — Feb 2026
### Added
- `CustomerOrderForm.jsx` — 4-step wizard at `/?order=1` (Kendaraan → Asal → Tujuan → Konfirmasi).
- `Order.css` — premium Navy + Gold theme matching driver palette.
- `POST /api/orders` — creates order with validation, server-side truncation, ID `ORD-{10 hex upper}`.
- `GET /api/orders[?status=&limit=]` — list orders newest-first, limit clamped 1..200.
- `GET /api/orders/{order_id}` — order detail (404 if not found).
- `GET /api/odoo/ping` — diagnostic for Odoo XML-RPC config.
- `backend/odoo_client.py` — `OdooClient` stub class. Env-gated XML-RPC via stdlib. Fire-and-forget when keys empty.
- Env placeholders in `backend/.env`: `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_KEY`.
- `notify_odoo("order.created", ...)` fired on every new order.
- `INTEGRATION_PO_ADMIN_PHP.md` sections 6 & 7 (BASTK link + Order form snippets).

### Tests
- New `backend/tests/test_orders_v26b.py` — 19 tests (POST validation, GET filters, Odoo ping, regression).
- Full suite **93/93 pass**.

---

## [v2.6a] — Feb 2026
### Added
- `BASTKPage.jsx` (~452 lines) — full premium A4 PDF generator at `/?bastk=<trip_id>`.
- `VehicleSketches.jsx` — 20 SVG vehicle sketches + `DAMAGE_CODES` (6 codes).
- `BASTK.css` — Navy + Gold print-area + dark editor.
- `POST /api/trips/{trip_id}/bastk` — partial update for vehicle_type/damage_marks/customer_data/signatures/catatan.
- Public endpoint exposes BASTK fields for customer tracking read-only.
- Routing in `App.js`: new `bastk` route.
- jspdf + html2canvas npm dependencies.

### Fixed
- Stale `v='2.4'` assertions in `test_driver_checkpoint.py` and `test_iteration6_pod.py` (now version-agnostic).
- TRIP-POD-DEMO seed self-heals daily checkpoint status+keterangan.

### Tests
- New `backend/tests/test_bastk_v26a.py` — 14 tests.

---

## [v2.5] — Earlier 2026
### Added
- Status enum on daily upload (Berangkat / CP1 / CP2 / CP3 / Tiba Tujuan).
- Optional 300-char keterangan per checkpoint.
- Reminder banner driver dashboard (06:00 WIB countdown).
- PoD PDF download per checkpoint.
- Status chip + keterangan display in PoD card.

---

## [v2.4] — Premium UI Pass
### Added
- Proof of Delivery card (premium, full PoD info).
- Theme migration to Navy + Gold palette.

---

## [v2.3]
- UI redesign — Navy & Gold dark premium.

## [v2.2]
- Album foto 4 tahap (asal/kapal/tujuan/dokumen).
- Customer Tracking page (read-only).

## [v2.1]
- Sinkronisasi PO Admin (trip_id), Xendit stub, Odoo webhook hook.

## [v2.0]
- Driver Checkpoint pivot: name + SOP + 5 initial photos + daily GPS.

## [v1.x]
- Leaflet + OSM live map, manifest form, nopol + driver checkpoint MVP.

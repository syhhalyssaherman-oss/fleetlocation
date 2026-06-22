# PRD — Alyssa Driver Checkpoint (v2.6c)

## Current Status
**v2.6c SHIPPED & STABLE.** 106/106 backend pytest pass, frontend 100% verified.

## Tech Stack
- React + Tailwind (custom theme Navy `#0A1628` + Gold `#D4A847`)
- FastAPI + Motor (Async MongoDB)
- Libraries: react-leaflet, jspdf, html2canvas, axios (frontend); xmlrpc.client stdlib (Odoo)

## App Structure (4 routes)
```
/?trip=<trip_id>[&driver=<id>]  → DriverCheckpoint   (driver-side, full lifecycle)
/?track=<trip_id>               → CustomerTracking   (read-only PoD)
/?bastk=<trip_id>               → BASTKPage          (premium A4 PDF generator)
/?order=1                       → CustomerOrderForm  (4-step wizard, public)
```

## Feature Matrix

### v2.6c (NEW)
- **QR Verifikasi BASTK**: scan-able QR (level=H, AAL logo center) pointing to `/?track=<trip_id>`. Metadata box dengan No. BASTK + Trip ID + No. Polisi + URL. Anti-fake corner accents.
- **`POST /api/orders/{id}/convert`**: idempotent order → trip bridge. Pre-fills route/nopol/vehicle/customer_data + sets `order.status=DISPATCHED`.
- **Real Odoo XML-RPC sync**: `_odoo_sync_order` best-effort `res.partner` + `sale.order` create. Env-gated, no-op when unconfigured, fire-and-forget.

### v2.6b (NEW)
- **CustomerOrderForm**: 4-step wizard (Kendaraan → Asal → Tujuan → Konfirmasi). All form fields with data-testid. Premium Navy+Gold stepper, gold-active step indicator, sticky bottom-nav. Success screen with order_id chip + "Buat Pesanan Lagi".
- **POST `/api/orders`**: validates vehicle_type against 20 enum (optional empty), requires asal_kota/tujuan_kota/customer_nama/customer_hp non-empty. Server-side truncation per field. Fires `notify_odoo("order.created", ...)` webhook.
- **GET `/api/orders?status=&limit=`**: list with status filter, newest-first, limit clamp 1..200.
- **GET `/api/orders/{order_id}`**: detail, 404 if not found.
- **OdooClient stub** (`backend/odoo_client.py`): env-gated XML-RPC (ODOO_URL/DB/USER/KEY). No-op when empty. `GET /api/odoo/ping` diagnostic endpoint.

### v2.6a
- **BASTK Premium PDF Generator** — A4 print-ready, multi-page split, html2canvas+jsPDF.
- **20 SVG vehicle sketches** (Sedan/MPV/SUV/Pickup/Double Cabin/CDD/Truck Box/Dump Truck/Tangki/Tronton/Box Besar/Canter/Canter Pemadam/Motor 2 Roda/Motor 3 Roda/Forklift/Excavator/Dozer/Grader/Vibro Roller).
- **Damage checklist hotspot** (6 codes RSK/B/P/PC/CL/L) — click-to-add markers.
- **Dual signature pad** (Driver + Customer), base64 PNG, persisted.
- **Customer data form** (whitelisted + truncated).

### v2.5
- Status enum (Berangkat/CP1/CP2/CP3/Tiba Tujuan) + keterangan (300 char)
- Reminder banner (06:00 WIB)
- PoD PDF download per checkpoint
- Status chip + keterangan box in PoD card

### v2.0-v2.4 (foundation)
- Driver flow: name → SOP read → 5 initial photos → daily GPS checkpoint
- Customer Tracking page (PoD card, album 4-stage, daily checkpoints)
- Xendit MOCKED stub
- Odoo webhook (notify_odoo, fire-and-forget)
- Trip init idempotent + legs support
- Album per stage (asal/kapal/tujuan/dokumen)

## DB Schema (additive, backward-compatible)
```js
// trips collection
{
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

// orders collection (v2.6b NEW)
{
  order_id,                         // "ORD-{10 hex upper}"
  status,                           // "NEW" → CONFIRMED → DISPATCHED → COMPLETED → CANCELLED
  vehicle_type, nopol, no_rangka, warna, tahun, km, kondisi,
  asal_kota, asal_alamat, pickup_date, pickup_time, pickup_pic, pickup_hp,
  tujuan_kota, tujuan_alamat, delivery_pic, delivery_hp,
  customer_nama, customer_hp, customer_email, catatan,
  trip_id,                          // null until admin converts order → trip
  created_at, updated_at,
}
```

## Testing Status (Feb-2026)
- **Backend**: **106/106 pytest pass** (49 base + 10 v2.5 + 14 v2.6a + 19 v2.6b + 13 v2.6c + 1 seed self-heal).
- **Frontend**: 100% — wizard E2E, BASTK QR + PDF, convert idempotent, regression clean.
- **Mocked APIs**: Xendit (legalitas pending), Odoo XML-RPC (env-gated, real SDK ready when credentials filled), notify_odoo webhook (no-op when ODOO_WEBHOOK_URL empty).

## Env (backend/.env)
```
MONGO_URL, DB_NAME, CORS_ORIGINS
ODOO_WEBHOOK_URL  # generic webhook (no-op when empty)
ODOO_URL, ODOO_DB, ODOO_USER, ODOO_KEY  # XML-RPC real SDK (placeholders)
```

## Integration ke PO Admin PHP
File `/app/INTEGRATION_PO_ADMIN_PHP.md` lengkap dengan snippet untuk:
1. URL constant
2. `kirimLinkCheckpoint()` (driver link)
3. `copyLinkTracking()` (customer link)
4. Odoo webhook env
5. Xendit drop-in (saat legalitas)
6. BASTK link (v2.6a)
7. Customer Order Form + Orders endpoint + Odoo XML-RPC (v2.6b)

## Demo URLs (TRIP-POD-DEMO)
- Driver: `/?trip=TRIP-POD-DEMO&driver=DRV-DEMO`
- Customer: `/?track=TRIP-POD-DEMO`
- BASTK: `/?bastk=TRIP-POD-DEMO` (seeded: Truck Box + 3 marks + customer Logistik Jaya)
- Order Form: `/?order=1` (fresh form, public)

## Roadmap (Backlog)
- **P1 ✅ DONE (v2.6c)**: Convert order → trip endpoint, Odoo XML-RPC scaffold.
- **P2** Real Xendit (legalitas done) — drop-in via `INTEGRATION_PO_ADMIN_PHP.md` §5.
- **P2** "Clear all marks" + sketch zoom/pan in BASTK editor (UX polish).
- **P2** Admin dashboard lokal: list orders + assign driver button calls `/convert`.
- **P3** BASTK auto-share via WhatsApp/email post-handover.
- **P3** Real Odoo product/uom mapping (currently sale.order created without order lines).
- **P3** Multi-language toggle (EN/ID).
- **P3** Upgrade vehicle sketches to high-detail premium illustrations (referensi image dari user).

# PRD — Alyssa Driver Checkpoint (v2.5)

## v2.5 Focus: Driver Checkpoint Status + Reminder + PoD PDF Download

## What's New in v2.5
- **Status enum** di daily upload: Berangkat / Checkpoint 1 / Checkpoint 2 / Checkpoint 3 / Tiba Tujuan
- **Keterangan** optional (max 300 char) — context catatan dari driver
- **Reminder banner** otomatis di driver dashboard:
  - `<06:00 WIB` → gold "Reminder Besok Pagi"
  - `06–12 WIB` → green "WAKTUNYA FOTO CHECKPOINT" + countdown sisa jam
  - `≥12 WIB` → red "TERLAMBAT! Foto deadline lewat"
- **PoD PDF Download** premium per checkpoint: header navy + brand AAL + foto besar + map + info lengkap, A4 portrait, filename `PoD-{nopol}-CP{n}.pdf`
- **Status chip** berwarna di PoD card (biru=Berangkat, green=CP1-3, gold=Tiba Tujuan)
- **Keterangan box** di PoD card kalau driver kasih catatan

## Deferred ke v2.6 (transparency)
Karena scope user expand besar di pesan terakhir, item berikut **belum** di-implement di v2.5 — fokus stabil dulu:
- BASTK PDF template generator (A4 portrait premium)
- 20 sketsa kendaraan (Sedan/MPV/SUV/Pickup/Double Cabin/CDD/Truck Box/Dump Truck/Tangki/Tronton/Box Besar/Canter/Canter Pemadam/Motor 2 Roda/Motor 3 Roda/Forklift/Excavator/Dozer/Grader/Vibro Roller)
- Damage checklist hotspot (RSK/B/P/PC/CL/L) di atas sketsa
- Customer order form 4-step (Kendaraan/Asal/Tujuan/Konfirmasi)
- Real Odoo SDK integration (webhook stub tetap aktif)
- Real Xendit (legalitas pending)

## DB Schema (additive only)
`daily_checkpoints` entry sekarang punya optional `status` + `keterangan`:
```js
daily_checkpoints: [
  { id, date, url, ts, lat?, lng?, status?, keterangan? }
]
```

## Testing
- Backend: **60/60 pytest pass** (49 regression + 10 v2.5 + seed-fix verified)
- Frontend: **100%** verified (form, reminder banner, status chip, PDF button)
- Seed TRIP-POD-DEMO sudah di-reseed dengan v2.5 fields untuk demo
- Mock APIs: 1 (Xendit MOCKED)

## Integration ke PO Admin PHP (existing)
File `/app/INTEGRATION_PO_ADMIN_PHP.md` masih valid — snippet untuk:
1. URL constant
2. Replace `kirimLinkCheckpoint()` (link ke React + push tipe/rangka/legs)
3. **Baru** `copyLinkTracking()` tombol untuk pelanggan
4. Odoo webhook env
5. Xendit drop-in saat legalitas done

## Next Iteration (v2.6) Roadmap
1. **VehicleSketches.jsx** — 20 SVG sketches library
2. **BASTK PDF generator page** `/?bastk=<trip_id>` — A4 premium dengan sketsa + checklist hotspot
3. **CustomerOrderForm.jsx** — 4-step wizard di `/?order=1`
4. **`POST /api/orders`** backend endpoint + Odoo webhook event `order.created`
5. **Damage checklist** UI dengan codes RSK/B/P/PC/CL/L (clickable hotspot di atas sketsa)
6. **Digital signature** canvas

## Next Action Items (User)
- Deploy v2.5 ke production (stabil, no breaking changes)
- Integrate snippet PHP ke PO Admin existing
- Lanjut iterasi v2.6 untuk BASTK + sketches + form (bisa di-iterasi terpisah)

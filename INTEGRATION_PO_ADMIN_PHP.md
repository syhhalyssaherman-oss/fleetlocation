# PO Admin PHP — Integration Snippets (v2.4)

Snippet siap copy-paste ke `po-admin.php` lu (existing). Ganti `REACT_APP_URL` dengan URL React app (PREVIEW atau PRODUCTION).

## 1. Konstanta URL (di awal `<script>`)

Tambah baris ini di sebelah `BASE_URL` yang sudah ada:

```js
// URL React app (driver + tracking)
var REACT_APP_URL = 'https://fleet-location-app-2.emergent.host';
// Untuk preview testing pakai:
// var REACT_APP_URL = 'https://fleet-location-app-2.preview.emergentagent.com';
```

## 2. Ganti tombol "Kirim CP" (function `kirimLinkCheckpoint`)

**REPLACE** function existing dengan ini — link sekarang arahin ke React app baru + push field `tipe`, `rangka`, `legs`:

```js
function kirimLinkCheckpoint(el){
  var poId=el.dataset.po, unitId=el.dataset.unit, nopol=el.dataset.nopol;
  var uj=parseInt(el.dataset.uj)||3500000;
  var t1=parseInt(el.dataset.t1)||Math.floor(uj*0.5);
  var t2=parseInt(el.dataset.t2)||Math.floor(uj*0.3);
  var t3=parseInt(el.dataset.t3)||(uj-Math.floor(uj*0.5)-Math.floor(uj*0.3));
  var route=el.dataset.route||nopol;
  var tipe=el.dataset.tipe||'';
  var rangka=el.dataset.rangka||'';
  var legsRaw=el.dataset.legs||'[]';

  var tripId='TRIP-'+poId+'-'+unitId;
  var link=REACT_APP_URL + '/?trip=' + encodeURIComponent(tripId)
    + '&driver=DRV-' + encodeURIComponent(unitId)
    + '&nopol=' + encodeURIComponent(nopol)
    + '&route=' + encodeURIComponent(route)
    + '&tipe='  + encodeURIComponent(tipe)
    + '&rangka=' + encodeURIComponent(rangka)
    + '&uj=' + uj + '&t1=' + t1 + '&t2=' + t2 + '&t3=' + t3
    + '&legs=' + encodeURIComponent(legsRaw);

  var lines=[
    'Halo Pak/Bu Driver,', '',
    'Link perjalanan unit '+nopol+':', link, '',
    'Pencairan Uang Jalan:',
    'Tahap 1: Rp '+t1.toLocaleString('id-ID')+' — cair saat 5 foto awal lengkap',
    'Tahap 2: Rp '+t2.toLocaleString('id-ID')+' — cair tengah jalan',
    'Tahap 3: Rp '+t3.toLocaleString('id-ID')+' — cair saat tiba', '',
    '🎁 Bonus: Foto checkpoint harian = Rp 30.000 langsung cair!', '',
    'Buka link → isi nama → baca SOP → foto unit → daily checkpoint tiap pagi.', '',
    'PT Alyssa Auto Logistik | 0818 631 135'
  ];
  window.open('https://wa.me/?text='+encodeURIComponent(lines.join('\n')),'_blank');
}
```

Untuk pakainya, tombol "Kirim CP" harus punya data attribute baru (`data-tipe`, `data-rangka`, `data-legs`). Update tombol di render PO:

```js
'<button ... data-po="'+po.id+'" data-unit="'+u.id+'" data-nopol="'+u.nopol+'"'
+' data-tipe="'+(u.tipe||'').replace(/"/g,'&quot;')+'"'
+' data-rangka="'+(u.rangka||'').replace(/"/g,'&quot;')+'"'
+' data-route="'+(legs.length?(legs[0].asal||'')+' - '+(legs[legs.length-1].tujuan||''):po.no_po)+'"'
+' data-uj="'+ujData+'" data-t1="'+t1Data+'" data-t2="'+t2Data+'" data-t3="'+t3Data+'"'
+' data-legs="'+JSON.stringify(legs||[]).replace(/"/g,'&quot;')+'"'
+' onclick="kirimLinkCheckpoint(this)">Kirim CP</button>'
```

## 3. **BARU** — Tombol "Copy Link Tracking" untuk pelanggan

Tambah function ini di `<script>`:

```js
function copyLinkTracking(po_id, unit_id, no_po, pelanggan, nopol){
  var tripId='TRIP-'+po_id+'-'+unit_id;
  var url=REACT_APP_URL + '/?track=' + encodeURIComponent(tripId);

  // Kalau mau langsung ke WA pelanggan, edit lines berikut + nomor HP:
  var lines=[
    'Halo '+pelanggan+',', '',
    'Berikut link tracking pengiriman '+nopol+':', url, '',
    'Anda bisa lihat foto, lokasi GPS, dan dokumen serah terima secara real-time.',
    'Halaman auto-refresh tiap 30 detik.', '',
    'Terima kasih telah mempercayai layanan kami.',
    'PT Alyssa Auto Logistik | 0818 631 135'
  ];
  // Copy ke clipboard
  navigator.clipboard.writeText(url).then(function(){
    if(confirm('Link tracking di-copy!\n\n'+url+'\n\nMau langsung buka WhatsApp share?')){
      window.open('https://wa.me/?text='+encodeURIComponent(lines.join('\n')),'_blank');
    }
  });
}
```

Tambah tombolnya di render PO Admin (di samping tombol "Copy Link" existing):

```js
// Di dalam unitsHtml, di sebelah delBtn atau "Kirim CP":
+'<button style="background:#0c2d3a;border:1px solid #38bdf8;color:#38bdf8;'
+'font-size:11px;padding:3px 9px;border-radius:6px;cursor:pointer;font-weight:600"'
+' onclick="copyLinkTracking(\''+po.id+'\',\''+u.id+'\',\''+po.no_po+'\',\''+(po.pelanggan||'').replace(/'/g,"\\'")+'\',\''+u.nopol+'\')">'
+'📦 Copy Link Tracking</button>'
```

## 4. (Opsional) — Aktifkan Odoo webhook

Set environment variable di backend `.env`:
```
ODOO_WEBHOOK_URL=https://alyssalogistik.co.id/odoo-proxy.php
```

Backend akan POST ke endpoint itu setiap kali ada event:
- `trip.initial_complete` — 5 foto awal selesai
- `trip.handover_complete` — BASTK + Resi terupload
- `trip.cair` — tiap tahap pencairan dipicu

Body format:
```json
{
  "event": "trip.cair",
  "data": { "trip_id": "...", "nopol": "...", "nama_driver": "...", "tahap": 1, "amount": 1750000, "bonus": 0, "total": 1750000 },
  "ts": "2026-06-22T08:30:00+00:00"
}
```

## 5. (Saat Xendit legalitas done) — Real disbursement

Backend `xendit_disburse()` di `server.py` saat ini MOCKED. Ganti isi function dengan:

```python
import xendit_python
xendit_python.api_key = os.environ['XENDIT_API_KEY']

@api_router.post("/trips/{trip_id}/xendit/disburse")
async def xendit_disburse(trip_id: str, payload: CairBody):
    trip = await db.trips.find_one({"trip_id": trip_id})
    if not trip: raise HTTPException(404, "Trip not found")
    # Map tahap → amount + driver bank account (admin must fill driver_bank in trip doc)
    amount = trip[f"t{payload.tahap}"]
    bank = trip.get("driver_bank", {})  # {bank_code, account_number, account_holder}
    result = xendit_python.Disbursement.create(
        external_id=f"trip-{trip_id}-t{payload.tahap}",
        bank_code=bank["bank_code"],
        account_holder_name=bank["account_holder"],
        account_number=bank["account_number"],
        description=f"UJ Tahap {payload.tahap} - {trip.get('nopol')}",
        amount=amount,
    )
    await db.trips.update_one({"trip_id": trip_id}, {"$set": {
        f"xendit.t{payload.tahap}": {"id": result.id, "status": result.status, "ts": datetime.now(timezone.utc).isoformat()}
    }})
    return {"disbursement_id": result.id, "status": result.status, "tahap": payload.tahap}
```

UI driver page tidak perlu diubah.

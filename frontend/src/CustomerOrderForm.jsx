import { useMemo, useState } from "react";
import axios from "axios";
import "@/App.css";
import "@/Driver.css";
import "@/Order.css";
import { VEHICLE_TYPE_LIST } from "@/VehicleSketches";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STEPS = [
  { key: "kendaraan", label: "Kendaraan", icon: "🚗" },
  { key: "asal",      label: "Asal",      icon: "📍" },
  { key: "tujuan",    label: "Tujuan",    icon: "🏁" },
  { key: "konfirmasi",label: "Konfirmasi",icon: "✅" },
];

const KONDISI_OPTIONS = ["Baru", "Bekas"];

function Field({ label, children, required, hint, full }) {
  return (
    <div className={`ord-field ${full ? "ord-field-full" : ""}`}>
      <label>
        {label}{required && <span className="ord-req"> *</span>}
      </label>
      {children}
      {hint && <div className="ord-hint">{hint}</div>}
    </div>
  );
}

export default function CustomerOrderForm() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    // kendaraan
    vehicle_type: "",
    nopol: "",
    warna: "",
    tahun: "",
    km: "",
    kondisi: "Bekas",
    no_rangka: "",
    // asal
    asal_kota: "",
    asal_alamat: "",
    pickup_date: "",
    pickup_time: "",
    pickup_pic: "",
    pickup_hp: "",
    // tujuan
    tujuan_kota: "",
    tujuan_alamat: "",
    delivery_pic: "",
    delivery_hp: "",
    // customer
    customer_nama: "",
    customer_hp: "",
    customer_email: "",
    catatan: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const setF = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const stepValid = useMemo(() => {
    if (step === 0) return !!data.vehicle_type;
    if (step === 1) return !!data.asal_kota.trim();
    if (step === 2) return !!data.tujuan_kota.trim();
    if (step === 3) return !!data.customer_nama.trim() && !!data.customer_hp.trim();
    return true;
  }, [step, data]);

  const goNext = () => { if (stepValid && step < STEPS.length - 1) setStep(step + 1); };
  const goPrev = () => { if (step > 0) setStep(step - 1); };

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/orders`, data);
      setResult(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Gagal mengirim pesanan. Coba lagi.");
    } finally { setSubmitting(false); }
  };

  if (result) return <SuccessScreen order={result} />;

  return (
    <div className="ord-root" data-testid="ord-root">
      <header className="ord-header">
        <div className="ord-brand">
          <div className="ord-brand-logo">
            <svg viewBox="0 0 80 80" width="44" height="44" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="40" cy="62" rx="22" ry="6" fill="#0F5132"/>
              <rect x="39" y="20" width="2" height="42" fill="#D4A847"/>
              <path d="M41,18 L62,25 L41,34 Z" fill="#DC2626"/>
            </svg>
          </div>
          <div>
            <div className="ord-brand-name">PT ALYSSA AUTO LOGISTIK</div>
            <div className="ord-brand-tag">Form Pemesanan Pengiriman Kendaraan</div>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="ord-stepper" data-testid="ord-stepper">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`ord-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
            onClick={() => { if (i < step) setStep(i); }}
            data-testid={`ord-step-${s.key}`}
          >
            <span className="ord-step-num">{i < step ? "✓" : i + 1}</span>
            <span className="ord-step-label">{s.icon} {s.label}</span>
          </button>
        ))}
      </div>

      {/* Step body */}
      <div className="ord-body">
        {step === 0 && (
          <section className="ord-card" data-testid="ord-card-kendaraan">
            <h2 className="ord-card-title">🚗 Data Kendaraan</h2>
            <div className="ord-grid">
              <Field label="Tipe Kendaraan" required full>
                <select
                  className="drv-step-input"
                  value={data.vehicle_type}
                  onChange={(e) => setF("vehicle_type", e.target.value)}
                  data-testid="ord-vehicle-type"
                >
                  <option value="">— Pilih tipe —</option>
                  {VEHICLE_TYPE_LIST.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="No. Polisi">
                <input type="text" className="drv-step-input" value={data.nopol}
                       onChange={(e) => setF("nopol", e.target.value.toUpperCase())}
                       placeholder="B 1234 ABC" data-testid="ord-nopol" />
              </Field>
              <Field label="No. Rangka">
                <input type="text" className="drv-step-input" value={data.no_rangka}
                       onChange={(e) => setF("no_rangka", e.target.value)}
                       placeholder="MHFE1CD1XXXXX" data-testid="ord-rangka" />
              </Field>
              <Field label="Warna">
                <input type="text" className="drv-step-input" value={data.warna}
                       onChange={(e) => setF("warna", e.target.value)} placeholder="Hitam"
                       data-testid="ord-warna" />
              </Field>
              <Field label="Tahun">
                <input type="text" className="drv-step-input" value={data.tahun} maxLength={4}
                       onChange={(e) => setF("tahun", e.target.value.replace(/\D/g, ""))}
                       placeholder="2024" data-testid="ord-tahun" />
              </Field>
              <Field label="Kilometer">
                <input type="text" className="drv-step-input" value={data.km}
                       onChange={(e) => setF("km", e.target.value)} placeholder="15000"
                       data-testid="ord-km" />
              </Field>
              <Field label="Kondisi">
                <select className="drv-step-input" value={data.kondisi}
                        onChange={(e) => setF("kondisi", e.target.value)}
                        data-testid="ord-kondisi">
                  {KONDISI_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="ord-card" data-testid="ord-card-asal">
            <h2 className="ord-card-title">📍 Lokasi Penjemputan (Asal)</h2>
            <div className="ord-grid">
              <Field label="Kota Asal" required>
                <input type="text" className="drv-step-input" value={data.asal_kota}
                       onChange={(e) => setF("asal_kota", e.target.value)} placeholder="Jakarta"
                       data-testid="ord-asal-kota" />
              </Field>
              <Field label="Alamat Lengkap" full>
                <textarea className="drv-step-input" rows={2} value={data.asal_alamat} maxLength={300}
                          onChange={(e) => setF("asal_alamat", e.target.value)}
                          placeholder="Jl. Sudirman No. 123, Jakarta Selatan"
                          data-testid="ord-asal-alamat" />
              </Field>
              <Field label="Tanggal Pickup">
                <input type="date" className="drv-step-input" value={data.pickup_date}
                       onChange={(e) => setF("pickup_date", e.target.value)}
                       data-testid="ord-pickup-date" />
              </Field>
              <Field label="Jam Pickup">
                <input type="time" className="drv-step-input" value={data.pickup_time}
                       onChange={(e) => setF("pickup_time", e.target.value)}
                       data-testid="ord-pickup-time" />
              </Field>
              <Field label="PIC Penjemputan">
                <input type="text" className="drv-step-input" value={data.pickup_pic}
                       onChange={(e) => setF("pickup_pic", e.target.value)} placeholder="Bpk. Andi"
                       data-testid="ord-pickup-pic" />
              </Field>
              <Field label="No. HP PIC">
                <input type="tel" className="drv-step-input" value={data.pickup_hp}
                       onChange={(e) => setF("pickup_hp", e.target.value)} placeholder="0818-1234"
                       data-testid="ord-pickup-hp" />
              </Field>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="ord-card" data-testid="ord-card-tujuan">
            <h2 className="ord-card-title">🏁 Lokasi Pengiriman (Tujuan)</h2>
            <div className="ord-grid">
              <Field label="Kota Tujuan" required>
                <input type="text" className="drv-step-input" value={data.tujuan_kota}
                       onChange={(e) => setF("tujuan_kota", e.target.value)} placeholder="Surabaya"
                       data-testid="ord-tujuan-kota" />
              </Field>
              <Field label="Alamat Lengkap" full>
                <textarea className="drv-step-input" rows={2} value={data.tujuan_alamat} maxLength={300}
                          onChange={(e) => setF("tujuan_alamat", e.target.value)}
                          placeholder="Jl. Pemuda No. 45, Surabaya"
                          data-testid="ord-tujuan-alamat" />
              </Field>
              <Field label="PIC Penerima">
                <input type="text" className="drv-step-input" value={data.delivery_pic}
                       onChange={(e) => setF("delivery_pic", e.target.value)}
                       placeholder="Ibu Siti" data-testid="ord-delivery-pic" />
              </Field>
              <Field label="No. HP Penerima">
                <input type="tel" className="drv-step-input" value={data.delivery_hp}
                       onChange={(e) => setF("delivery_hp", e.target.value)}
                       placeholder="0818-5678" data-testid="ord-delivery-hp" />
              </Field>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="ord-card" data-testid="ord-card-konfirmasi">
            <h2 className="ord-card-title">✅ Konfirmasi & Data Pemesan</h2>
            <div className="ord-grid">
              <Field label="Nama / PT" required>
                <input type="text" className="drv-step-input" value={data.customer_nama}
                       onChange={(e) => setF("customer_nama", e.target.value)}
                       placeholder="PT Logistik Jaya" data-testid="ord-customer-nama" />
              </Field>
              <Field label="No. HP / WA" required>
                <input type="tel" className="drv-step-input" value={data.customer_hp}
                       onChange={(e) => setF("customer_hp", e.target.value)}
                       placeholder="0818-9876" data-testid="ord-customer-hp" />
              </Field>
              <Field label="Email" full>
                <input type="email" className="drv-step-input" value={data.customer_email}
                       onChange={(e) => setF("customer_email", e.target.value)}
                       placeholder="purchasing@perusahaan.com"
                       data-testid="ord-customer-email" />
              </Field>
              <Field label="Catatan Tambahan" full hint="Maks 500 karakter">
                <textarea className="drv-step-input" rows={3} value={data.catatan} maxLength={500}
                          onChange={(e) => setF("catatan", e.target.value)}
                          placeholder="Cth: tolong dijemput sore, kunci ada di security."
                          data-testid="ord-catatan" />
              </Field>
            </div>

            <div className="ord-summary">
              <div className="ord-summary-head">RINGKASAN PESANAN</div>
              <SummaryRow k="Kendaraan" v={`${data.vehicle_type || "—"} ${data.nopol ? `(${data.nopol})` : ""}`} />
              <SummaryRow k="Warna / Tahun" v={`${data.warna || "—"} / ${data.tahun || "—"}`} />
              <SummaryRow k="Asal"  v={`${data.asal_kota}${data.asal_alamat ? ` — ${data.asal_alamat}` : ""}`} />
              <SummaryRow k="Pickup" v={`${data.pickup_date || "—"} ${data.pickup_time || ""}`} />
              <SummaryRow k="Tujuan" v={`${data.tujuan_kota}${data.tujuan_alamat ? ` — ${data.tujuan_alamat}` : ""}`} />
              <SummaryRow k="PIC Penerima" v={`${data.delivery_pic || "—"} ${data.delivery_hp ? `(${data.delivery_hp})` : ""}`} />
            </div>

            {error && <div className="ord-error" data-testid="ord-error">⚠ {error}</div>}
          </section>
        )}
      </div>

      {/* Bottom nav */}
      <div className="ord-nav">
        <button
          type="button"
          className="ord-btn ord-btn-ghost"
          onClick={goPrev}
          disabled={step === 0 || submitting}
          data-testid="ord-btn-prev"
        >← Kembali</button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="ord-btn ord-btn-gold"
            onClick={goNext}
            disabled={!stepValid}
            data-testid="ord-btn-next"
          >Lanjut →</button>
        ) : (
          <button
            type="button"
            className="ord-btn ord-btn-gold"
            onClick={submit}
            disabled={!stepValid || submitting}
            data-testid="ord-btn-submit"
          >
            {submitting ? "Mengirim..." : "🚀 Kirim Pesanan"}
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ k, v }) {
  return (
    <div className="ord-summary-row">
      <div className="ord-summary-k">{k}</div>
      <div className="ord-summary-v">{v || "—"}</div>
    </div>
  );
}

function SuccessScreen({ order }) {
  const trackUrl = order.trip_id ? `${window.location.origin}/?track=${order.trip_id}` : "";
  return (
    <div className="ord-root">
      <div className="ord-success" data-testid="ord-success">
        <div className="ord-success-badge">✓</div>
        <h1>Pesanan Terkirim!</h1>
        <p>Tim Alyssa akan menghubungi Anda dalam 1×24 jam.</p>

        <div className="ord-success-card">
          <div className="ord-success-row">
            <div className="ord-success-k">ID Pesanan</div>
            <div className="ord-success-v ord-mono" data-testid="ord-success-id">{order.order_id}</div>
          </div>
          <div className="ord-success-row">
            <div className="ord-success-k">Status</div>
            <div className="ord-success-v">
              <span className="ord-status-chip">{order.status}</span>
            </div>
          </div>
          <div className="ord-success-row">
            <div className="ord-success-k">Rute</div>
            <div className="ord-success-v">{order.asal_kota} → {order.tujuan_kota}</div>
          </div>
          <div className="ord-success-row">
            <div className="ord-success-k">Kontak</div>
            <div className="ord-success-v">{order.customer_nama} · {order.customer_hp}</div>
          </div>
        </div>

        {trackUrl && (
          <a className="ord-btn ord-btn-gold" href={trackUrl} data-testid="ord-success-track">
            Lacak Pesanan →
          </a>
        )}
        <a className="ord-btn ord-btn-ghost" href="?order=1" data-testid="ord-success-new">
          Buat Pesanan Lagi
        </a>

        <div className="ord-success-meta">
          Simpan ID pesanan untuk referensi. Hubungi <b>0818 631 135</b> untuk pertanyaan.
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "@/App.css";
import "@/Driver.css";
import "@/Admin.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const PIN_KEY = "aal_admin_pin";

const STATUS_LIST = ["NEW", "DISPATCHED", "ON_TRIP", "DELIVERED", "CANCELLED"];
const STATUS_LABEL = {
  NEW:        { txt: "Baru",       cls: "adm-chip-new"  },
  DISPATCHED: { txt: "Dispatched", cls: "adm-chip-disp" },
  ON_TRIP:    { txt: "On-Trip",    cls: "adm-chip-trip" },
  DELIVERED:  { txt: "Delivered",  cls: "adm-chip-done" },
  CANCELLED:  { txt: "Batal",      cls: "adm-chip-cancel" },
};

const fmtDate = (s) => {
  if (!s) return "—";
  try { const d = new Date(s); return d.toLocaleString("id-ID", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"}); }
  catch { return s; }
};

export default function AdminDashboard() {
  const [pin, setPin] = useState(() => localStorage.getItem(PIN_KEY) || "");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authing, setAuthing] = useState(false);

  // Auto-auth if PIN cached (run once on mount)
  useEffect(() => {
    const cached = localStorage.getItem(PIN_KEY) || "";
    if (!cached) return;
    (async () => {
      try {
        const r = await axios.post(`${API}/admin/auth`, { pin: cached });
        if (r.data?.ok) setAuthed(true);
      } catch { localStorage.removeItem(PIN_KEY); setPin(""); }
    })();
  }, []);

  const doLogin = async () => {
    setAuthing(true); setAuthError("");
    try {
      await axios.post(`${API}/admin/auth`, { pin: pin.trim() });
      localStorage.setItem(PIN_KEY, pin.trim());
      setAuthed(true);
    } catch (e) {
      setAuthError(e?.response?.data?.detail || "PIN salah");
    } finally { setAuthing(false); }
  };

  const logout = () => { localStorage.removeItem(PIN_KEY); setPin(""); setAuthed(false); };

  if (!authed) return (
    <PinScreen pin={pin} setPin={setPin} doLogin={doLogin} authing={authing} authError={authError} />
  );
  return <Dashboard pin={pin} onLogout={logout} />;
}

/* -------------------- PIN screen -------------------- */
function PinScreen({ pin, setPin, doLogin, authing, authError }) {
  return (
    <div className="adm-root">
      <div className="adm-pin-wrap" data-testid="adm-pin-wrap">
        <div className="adm-pin-logo">
          <svg viewBox="0 0 80 80" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="40" cy="62" rx="22" ry="6" fill="#0F5132"/>
            <rect x="39" y="20" width="2" height="42" fill="#D4A847"/>
            <path d="M41,18 L62,25 L41,34 Z" fill="#DC2626"/>
          </svg>
        </div>
        <h1 className="adm-pin-title">Admin Dashboard</h1>
        <p className="adm-pin-sub">PT Alyssa Auto Logistik · Internal Control</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }}
          className="adm-pin-input"
          placeholder="••••"
          data-testid="adm-pin-input"
          maxLength={20}
        />
        {authError && <div className="adm-pin-err" data-testid="adm-pin-err">{authError}</div>}
        <button
          className="adm-btn adm-btn-gold adm-pin-btn"
          onClick={doLogin}
          disabled={authing || !pin}
          data-testid="adm-pin-submit"
        >{authing ? "Memverifikasi..." : "Masuk"}</button>
        <div className="adm-pin-hint">Hubungi admin sistem jika lupa PIN.</div>
      </div>
    </div>
  );
}

/* -------------------- Dashboard -------------------- */
function Dashboard({ pin, onLogout }) {
  const headers = useMemo(() => ({ "X-Admin-Pin": pin }), [pin]);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [convertModal, setConvertModal] = useState(null);
  const [toast, setToast] = useState("");

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2400); };

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      const [s, o] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }),
        axios.get(`${API}/admin/orders`, { headers, params }),
      ]);
      setStats(s.data);
      setOrders(o.data?.items || []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Gagal memuat data");
    } finally { setLoading(false); }
  }, [headers, statusFilter, search, dateFrom, dateTo]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const patchOrder = async (orderId, body) => {
    try {
      await axios.patch(`${API}/admin/orders/${orderId}`, body, { headers });
      flash("Tersimpan");
      await loadAll();
    } catch (e) { flash("Gagal: " + (e?.response?.data?.detail || "error")); }
  };

  const doConvert = async (orderId, body) => {
    try {
      const r = await axios.post(`${API}/orders/${orderId}/convert`, body, { headers });
      flash(`Trip dibuat: ${r.data.trip_id}`);
      setConvertModal(null);
      await loadAll();
    } catch (e) { flash("Gagal: " + (e?.response?.data?.detail || "error")); }
  };

  const exportCsv = async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.q = search.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      const r = await axios.get(`${API}/admin/orders/export.csv`, {
        headers,
        params,
        responseType: "blob",
      });
      const blob = new Blob([r.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0,10).replace(/-/g,"");
      a.download = `alyssa-orders-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash("CSV diunduh");
    } catch (e) {
      flash("Gagal export: " + (e?.response?.data?.detail || "error"));
    }
  };

  return (
    <div className="adm-root" data-testid="adm-dashboard">
      {/* Top bar */}
      <header className="adm-topbar">
        <div className="adm-topbar-left">
          <div className="adm-topbar-title">Admin Control</div>
          <div className="adm-topbar-sub">PT Alyssa Auto Logistik</div>
        </div>
        <div className="adm-topbar-actions">
          <a href="?guide=1" target="_blank" rel="noreferrer" className="adm-btn adm-btn-ghost adm-btn-sm" data-testid="adm-tutorial-link">
            📘 Tutorial
          </a>
          <button className="adm-btn adm-btn-gold adm-btn-sm" onClick={exportCsv} data-testid="adm-export-csv">
            📥 Export CSV
          </button>
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={loadAll} data-testid="adm-refresh">
            ↻ Refresh
          </button>
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={onLogout} data-testid="adm-logout">
            ⤴ Logout
          </button>
        </div>
      </header>

      {/* Stats strip */}
      {stats && (
        <section className="adm-stats" data-testid="adm-stats">
          <StatTile label="Total Pesanan" value={stats.total} cls="" />
          {STATUS_LIST.map((s) => (
            <StatTile
              key={s}
              label={STATUS_LABEL[s].txt}
              value={stats.by_status?.[s] || 0}
              cls={STATUS_LABEL[s].cls + " adm-stat-clickable"}
              onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              active={statusFilter === s}
              testid={`adm-stat-${s.toLowerCase()}`}
            />
          ))}
        </section>
      )}

      {/* Filters */}
      <section className="adm-filters">
        <input
          type="search"
          className="adm-search"
          placeholder="🔍 Cari nama, HP, kota, nopol, atau ID order…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="adm-search"
        />
        <select
          className="adm-status-sel"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="adm-status-filter"
        >
          <option value="">Semua status</option>
          {STATUS_LIST.map((s) => <option key={s} value={s}>{STATUS_LABEL[s].txt}</option>)}
        </select>
        <div className="adm-date-range">
          <label className="adm-date-lbl">Dari</label>
          <input type="date" className="adm-date" value={dateFrom}
                 onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined}
                 data-testid="adm-date-from" />
          <label className="adm-date-lbl">Sampai</label>
          <input type="date" className="adm-date" value={dateTo}
                 onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined}
                 data-testid="adm-date-to" />
        </div>
        {(search || statusFilter || dateFrom || dateTo) && (
          <button
            type="button"
            className="adm-btn adm-btn-ghost adm-btn-sm"
            onClick={() => { setSearch(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); }}
            data-testid="adm-filter-reset"
          >✕ Reset filter</button>
        )}
      </section>

      {/* Orders list */}
      <section className="adm-list" data-testid="adm-list">
        {loading && <div className="adm-loading">Memuat…</div>}
        {error && <div className="adm-error" data-testid="adm-list-err">{error}</div>}
        {!loading && !error && orders.length === 0 && (
          <div className="adm-empty" data-testid="adm-empty">
            <div className="adm-empty-icon">📭</div>
            Tidak ada pesanan {statusFilter ? `dengan status ${STATUS_LABEL[statusFilter].txt}` : ""}.
          </div>
        )}
        {orders.map((o) => (
          <OrderCard
            key={o.order_id}
            order={o}
            onConvert={() => setConvertModal(o)}
            onPatch={(body) => patchOrder(o.order_id, body)}
          />
        ))}
      </section>

      {toast && <div className="adm-toast" data-testid="adm-toast">{toast}</div>}

      {convertModal && (
        <ConvertModal
          order={convertModal}
          onClose={() => setConvertModal(null)}
          onSubmit={(body) => doConvert(convertModal.order_id, body)}
        />
      )}
    </div>
  );
}

/* -------------------- Sub-components -------------------- */
function StatTile({ label, value, cls = "", onClick, active, testid }) {
  return (
    <div
      className={`adm-stat ${cls} ${active ? "adm-stat-active" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      data-testid={testid}
    >
      <div className="adm-stat-val">{value}</div>
      <div className="adm-stat-lbl">{label}</div>
    </div>
  );
}

function OrderCard({ order, onConvert, onPatch }) {
  const [editingDriver, setEditingDriver] = useState(false);
  const [driverDraft, setDriverDraft] = useState(order.driver_id || "");
  const lbl = STATUS_LABEL[order.status] || { txt: order.status, cls: "adm-chip-new" };
  const isNew = order.status === "NEW";
  const linkDriver = order.trip_id ? `/trip/${order.trip_id}${order.driver_id ? `?driver=${order.driver_id}` : ""}${order.nopol ? `${order.driver_id ? "&" : "?"}nopol=${encodeURIComponent(order.nopol)}` : ""}` : null;
  const linkTrack  = order.trip_id ? `/track/${order.trip_id}` : null;
  const linkBastk  = order.trip_id ? `/bastk/${order.trip_id}` : null;

  const saveDriver = async () => {
    await onPatch({ driver_id: driverDraft });
    setEditingDriver(false);
  };

  return (
    <article className="adm-card" data-testid={`adm-order-${order.order_id}`}>
      <header className="adm-card-head">
        <div className="adm-card-id">
          <span className="adm-mono">{order.order_id}</span>
          <span className={`adm-chip ${lbl.cls}`} data-testid={`adm-status-${order.order_id}`}>
            {lbl.txt}
          </span>
        </div>
        <div className="adm-card-date">{fmtDate(order.created_at)}</div>
      </header>

      <div className="adm-card-body">
        <div className="adm-row">
          <span className="adm-k">Pelanggan</span>
          <span className="adm-v">{order.customer_nama || "—"} · {order.customer_hp || "—"}</span>
        </div>
        <div className="adm-row">
          <span className="adm-k">Rute</span>
          <span className="adm-v">{order.asal_kota || "—"} → {order.tujuan_kota || "—"}</span>
        </div>
        <div className="adm-row">
          <span className="adm-k">Kendaraan</span>
          <span className="adm-v">
            {order.vehicle_type || "—"} {order.nopol && <span className="adm-mono adm-pill-mini">{order.nopol}</span>}
          </span>
        </div>
        {order.trip_id && (
          <div className="adm-row">
            <span className="adm-k">Trip ID</span>
            <span className="adm-v adm-mono">{order.trip_id}</span>
          </div>
        )}
        <div className="adm-row">
          <span className="adm-k">Driver</span>
          <span className="adm-v">
            {editingDriver ? (
              <span className="adm-driver-edit">
                <input
                  className="adm-input-inline"
                  value={driverDraft}
                  onChange={(e) => setDriverDraft(e.target.value)}
                  placeholder="DRV-XXXX"
                  data-testid={`adm-driver-input-${order.order_id}`}
                />
                <button className="adm-btn adm-btn-gold adm-btn-xs" onClick={saveDriver} data-testid={`adm-driver-save-${order.order_id}`}>OK</button>
                <button className="adm-btn adm-btn-ghost adm-btn-xs" onClick={() => { setEditingDriver(false); setDriverDraft(order.driver_id || ""); }}>×</button>
              </span>
            ) : (
              <span className="adm-driver-show">
                {order.driver_id ? <span className="adm-mono adm-pill-mini">{order.driver_id}</span> : <i className="adm-mute">belum di-assign</i>}
                <button className="adm-link" onClick={() => setEditingDriver(true)} data-testid={`adm-driver-edit-${order.order_id}`}>✎</button>
              </span>
            )}
          </span>
        </div>
      </div>

      <footer className="adm-card-actions">
        {isNew && (
          <button className="adm-btn adm-btn-gold adm-btn-sm" onClick={onConvert} data-testid={`adm-convert-${order.order_id}`}>
            🚚 Konversi → Trip
          </button>
        )}
        {order.status === "DISPATCHED" && (
          <button className="adm-btn adm-btn-blue adm-btn-sm" onClick={() => onPatch({ status: "ON_TRIP" })} data-testid={`adm-mark-ontrip-${order.order_id}`}>
            ▶ Mark On-Trip
          </button>
        )}
        {order.status === "ON_TRIP" && (
          <button className="adm-btn adm-btn-green adm-btn-sm" onClick={() => onPatch({ status: "DELIVERED" })} data-testid={`adm-mark-delivered-${order.order_id}`}>
            ✓ Mark Delivered
          </button>
        )}
        {linkDriver  && <a className="adm-btn adm-btn-ghost adm-btn-sm" href={linkDriver}  target="_blank" rel="noreferrer" data-testid={`adm-link-driver-${order.order_id}`}>Driver</a>}
        {linkTrack   && <a className="adm-btn adm-btn-ghost adm-btn-sm" href={linkTrack}   target="_blank" rel="noreferrer" data-testid={`adm-link-track-${order.order_id}`}>Track</a>}
        {linkBastk   && <a className="adm-btn adm-btn-ghost adm-btn-sm" href={linkBastk}   target="_blank" rel="noreferrer" data-testid={`adm-link-bastk-${order.order_id}`}>BASTK</a>}
        {!["DELIVERED","CANCELLED"].includes(order.status) && (
          <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => { if (window.confirm("Batalkan order ini?")) onPatch({ status: "CANCELLED" }); }} data-testid={`adm-cancel-${order.order_id}`}>
            ✕ Batal
          </button>
        )}
      </footer>
    </article>
  );
}

function ConvertModal({ order, onClose, onSubmit }) {
  const [driverId, setDriverId] = useState("");
  const [uj, setUj] = useState("0");
  const [t1, setT1] = useState("0");
  const [t2, setT2] = useState("0");
  const [t3, setT3] = useState("0");
  const [bd, setBd] = useState("30000");
  const [bk, setBk] = useState("150000");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    await onSubmit({
      driver_id: driverId.trim() || undefined,
      uj: parseInt(uj || "0", 10),
      t1: parseInt(t1 || "0", 10),
      t2: parseInt(t2 || "0", 10),
      t3: parseInt(t3 || "0", 10),
      bonus_daily: parseInt(bd || "0", 10),
      bonus_kerajinan: parseInt(bk || "0", 10),
    });
    setSubmitting(false);
  };

  return (
    <div className="adm-modal-bg" onClick={onClose} data-testid="adm-convert-modal">
      <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="adm-modal-head">
          <div>
            <div className="adm-modal-title">🚚 Konversi Pesanan → Trip</div>
            <div className="adm-modal-sub adm-mono">{order.order_id}</div>
          </div>
          <button className="adm-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="adm-modal-body">
          <div className="adm-modal-info">
            <b>{order.customer_nama}</b> · {order.asal_kota} → {order.tujuan_kota}
            <br/><span className="adm-mute">{order.vehicle_type || "—"} {order.nopol || ""}</span>
          </div>
          <div className="adm-form-grid">
            <Field label="Driver ID" hint="Opsional. Bisa diisi nanti.">
              <input className="adm-input" value={driverId} onChange={(e) => setDriverId(e.target.value)} placeholder="DRV-001" data-testid="adm-modal-driver" />
            </Field>
            <Field label="Uang Jalan (UJ)">
              <input type="number" min="0" className="adm-input" value={uj} onChange={(e) => setUj(e.target.value)} data-testid="adm-modal-uj" />
            </Field>
            <Field label="Tahap 1 (T1)">
              <input type="number" min="0" className="adm-input" value={t1} onChange={(e) => setT1(e.target.value)} data-testid="adm-modal-t1" />
            </Field>
            <Field label="Tahap 2 (T2)">
              <input type="number" min="0" className="adm-input" value={t2} onChange={(e) => setT2(e.target.value)} data-testid="adm-modal-t2" />
            </Field>
            <Field label="Tahap 3 (T3)">
              <input type="number" min="0" className="adm-input" value={t3} onChange={(e) => setT3(e.target.value)} data-testid="adm-modal-t3" />
            </Field>
            <Field label="Bonus Harian">
              <input type="number" min="0" className="adm-input" value={bd} onChange={(e) => setBd(e.target.value)} />
            </Field>
            <Field label="Bonus Kerajinan">
              <input type="number" min="0" className="adm-input" value={bk} onChange={(e) => setBk(e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="adm-modal-footer">
          <button className="adm-btn adm-btn-ghost" onClick={onClose} disabled={submitting}>Batal</button>
          <button className="adm-btn adm-btn-gold" onClick={submit} disabled={submitting} data-testid="adm-modal-submit">
            {submitting ? "Memproses..." : "Konversi Sekarang"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="adm-field">
      <span className="adm-field-lbl">{label}</span>
      {children}
      {hint && <span className="adm-field-hint">{hint}</span>}
    </label>
  );
}

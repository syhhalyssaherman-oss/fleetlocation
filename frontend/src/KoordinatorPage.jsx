import { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const KORD_KEY = "aal_kord_nama";

const STATUS_LABEL = {
  NEW:        { txt: "Baru",       color: "#8b949e" },
  DISPATCHED: { txt: "Dispatched", color: "#d29922" },
  ON_TRIP:    { txt: "On-Trip",    color: "#1f6feb" },
  DELIVERED:  { txt: "Delivered",  color: "#2ea043" },
  CANCELLED:  { txt: "Batal",      color: "#f85149" },
};

const TIPE_ICON = {
  "Self Drive": "🚗",
  "Kapal RoRo": "🚢",
  "Kapal Kontainer": "🚢",
  "Car Carrier": "🚛",
  "Towing": "🔗",
  "Self Loader": "🏗",
  "Lainnya": "📦",
};

function waLink(hp) {
  if (!hp) return null;
  const digits = hp.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "62" + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

function ContactBtn({ label, hp, style }) {
  const link = waLink(hp);
  if (!link) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "inline-block",
        padding: "5px 12px",
        borderRadius: 6,
        background: "#1a4731",
        color: "#2ea043",
        fontSize: 12,
        fontWeight: 700,
        textDecoration: "none",
        border: "1px solid #2ea043",
        ...style,
      }}
    >
      💬 {label}
    </a>
  );
}

function LegCard({ leg }) {
  const isKapal = leg.tipe && leg.tipe.startsWith("Kapal");
  return (
    <div style={{
      background: "#0d1117",
      border: "1px solid #21262d",
      borderRadius: 8,
      padding: "10px 12px",
      marginBottom: 6,
    }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 15 }}>{TIPE_ICON[leg.tipe] || "📦"}</span>
        <span style={{ fontWeight: 700, fontSize: 12, color: "#EF9F27" }}>{leg.tipe}</span>
        <span style={{ color: "#8b949e", fontSize: 11 }}>{leg.asal || "—"} → {leg.tujuan || "—"}</span>
        {leg.status && (
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#8b949e", background: "#161b22", borderRadius: 4, padding: "2px 6px" }}>{leg.status}</span>
        )}
      </div>

      {!isKapal && leg.driver && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700, marginBottom: 3 }}>DRIVER</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#e6edf3" }}>{leg.driver}</span>
            {leg.driver_hp && <span style={{ fontSize: 11, color: "#8b949e" }}>{leg.driver_hp}</span>}
            {leg.driver_hp && <ContactBtn label="Hubungi Driver" hp={leg.driver_hp} />}
          </div>
        </div>
      )}

      {!isKapal && leg.kord_bayangan && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 700, marginBottom: 3 }}>KOORDINATOR BAYANGAN</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#e6edf3" }}>{leg.kord_bayangan}</span>
            {leg.kord_bayangan_hp && <span style={{ fontSize: 11, color: "#8b949e" }}>{leg.kord_bayangan_hp}</span>}
            {leg.kord_bayangan_hp && <ContactBtn label="Hubungi Kord Bayangan" hp={leg.kord_bayangan_hp} />}
          </div>
        </div>
      )}

      {isKapal && leg.kapal && (
        <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>⚓ {leg.kapal}{leg.marking ? ` · ${leg.marking}` : ""}</div>
      )}

      {isKapal && leg.kord_kapal && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 700, marginBottom: 3 }}>KOORDINATOR KAPAL</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#e6edf3" }}>{leg.kord_kapal}</span>
            {leg.kord_kapal_hp && <span style={{ fontSize: 11, color: "#8b949e" }}>{leg.kord_kapal_hp}</span>}
            {leg.kord_kapal_hp && <ContactBtn label="Hubungi Kord Kapal" hp={leg.kord_kapal_hp} />}
          </div>
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }) {
  const sl = STATUS_LABEL[trip.status] || { txt: trip.status, color: "#8b949e" };
  const handover = trip.handover || {};
  return (
    <div style={{
      background: "#161b22",
      border: "1px solid #30363d",
      borderRadius: 12,
      padding: "14px 16px",
      marginBottom: 14,
    }}>
      {/* Head */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#EF9F27", marginBottom: 2 }}>
            {trip.nopol || trip.vehicle_type || "—"}
          </div>
          <div style={{ fontSize: 12, color: "#e6edf3" }}>
            {trip.asal_kota || "—"} → {trip.tujuan_kota || "—"}
          </div>
          {trip.customer_nama && (
            <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>
              Pelanggan: {trip.customer_nama}
            </div>
          )}
        </div>
        <span style={{
          background: sl.color + "22",
          color: sl.color,
          border: `1px solid ${sl.color}44`,
          borderRadius: 6,
          padding: "3px 10px",
          fontSize: 11,
          fontWeight: 700,
        }}>{sl.txt}</span>
      </div>

      {/* Handover status */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 11 }}>
          BASTK: <span style={{ color: handover.bastk ? "#2ea043" : "#f85149", fontWeight: 700 }}>{handover.bastk ? "✓" : "✗"}</span>
        </span>
        <span style={{ fontSize: 11 }}>
          Resi: <span style={{ color: handover.resi ? "#2ea043" : "#f85149", fontWeight: 700 }}>{handover.resi ? "✓" : "✗"}</span>
        </span>
        <span style={{ fontSize: 11, color: "#8b949e" }}>
          Checkpoint: {trip.daily_checkpoints_count || 0}
          {trip.last_checkpoint && <span> · Terakhir: {new Date(trip.last_checkpoint).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>}
        </span>
      </div>

      {/* Legs */}
      {Array.isArray(trip.legs) && trip.legs.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>RUTE LEG</div>
          {trip.legs.map((leg, i) => <LegCard key={i} leg={leg} />)}
        </div>
      )}
    </div>
  );
}

export default function KoordinatorPage() {
  const [nama, setNama] = useState(() => {
    try { return localStorage.getItem(KORD_KEY) || ""; } catch { return ""; }
  });
  const [draft, setDraft] = useState("");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loggedIn = !!nama;

  const login = () => {
    const n = draft.trim();
    if (!n) return;
    try { localStorage.setItem(KORD_KEY, n); } catch {}
    setNama(n);
  };

  const logout = () => {
    try { localStorage.removeItem(KORD_KEY); } catch {}
    setNama("");
    setDraft("");
    setTrips([]);
  };

  useEffect(() => {
    if (!nama) return;
    setLoading(true);
    setError(null);
    axios.get(`${API}/koordinator/trips`, { params: { nama } })
      .then(r => setTrips(r.data.items || []))
      .catch(e => setError(e?.response?.data?.detail || "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [nama]);

  const S = {
    root: {
      minHeight: "100vh",
      background: "#0d1117",
      color: "#e6edf3",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      padding: "0 0 40px",
    },
    header: {
      background: "#161b22",
      borderBottom: "1px solid #21262d",
      padding: "14px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: { fontSize: 15, fontWeight: 800, color: "#EF9F27" },
    sub: { fontSize: 11, color: "#8b949e" },
    body: { maxWidth: 560, margin: "0 auto", padding: "20px 16px 0" },
  };

  if (!loggedIn) {
    return (
      <div style={S.root}>
        <div style={S.header}>
          <div>
            <div style={S.title}>Portal Koordinator</div>
            <div style={S.sub}>PT Alyssa Auto Logistik</div>
          </div>
        </div>
        <div style={{ ...S.body, maxWidth: 400 }}>
          <div style={{
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 12,
            padding: "28px 24px",
            marginTop: 40,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#EF9F27", marginBottom: 6 }}>Masuk sebagai Koordinator</div>
            <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 20 }}>
              Masukkan nama Anda persis seperti yang didaftarkan admin.
            </div>
            <input
              style={{
                width: "100%",
                background: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: 7,
                padding: "10px 12px",
                color: "#e6edf3",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 14,
              }}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="Nama koordinator..."
              autoFocus
            />
            <button
              onClick={login}
              disabled={!draft.trim()}
              style={{
                width: "100%",
                background: draft.trim() ? "#EF9F27" : "#30363d",
                color: draft.trim() ? "#0d1117" : "#8b949e",
                border: "none",
                borderRadius: 7,
                padding: "11px",
                fontWeight: 800,
                fontSize: 14,
                cursor: draft.trim() ? "pointer" : "default",
              }}
            >Masuk</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Portal Koordinator</div>
          <div style={S.sub}>{nama}</div>
        </div>
        <button
          onClick={logout}
          style={{
            background: "none",
            border: "1px solid #30363d",
            color: "#8b949e",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >Keluar</button>
      </div>

      <div style={S.body}>
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#8b949e" }}>Memuat data trip…</div>
        )}
        {error && (
          <div style={{ background: "#2d1117", border: "1px solid #f85149", borderRadius: 8, padding: "12px 16px", color: "#f85149", marginBottom: 16 }}>
            {error}
          </div>
        )}
        {!loading && !error && trips.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#8b949e" }}>
            Tidak ada trip yang ditugaskan ke <b style={{ color: "#e6edf3" }}>{nama}</b>.
          </div>
        )}
        {trips.map(t => <TripCard key={t.trip_id} trip={t} />)}
      </div>
    </div>
  );
}

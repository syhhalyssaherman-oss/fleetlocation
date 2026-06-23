import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Tracking.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/* Resolve foto URL — Supabase URLs sudah absolute, lainnya prepend BACKEND_URL */
function resolveUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${BACKEND_URL}${url}`;
}
const ALBUM_STAGES = ["asal", "kapal", "tujuan", "dokumen"];

/* ── Fix leaflet default icon ── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function stageLabel(s) {
  return { asal: "Asal", kapal: "Di Kapal", tujuan: "Tujuan", dokumen: "Dokumen" }[s] || s;
}

function readTripId() {
  const u = new URL(window.location.href);
  const seg = u.pathname.match(/^\/track\/(.+)/);
  if (seg) return decodeURIComponent(seg[1]);
  return u.searchParams.get("track") || "";
}

function fmtTs(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function fmtTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/* ── Icons ── */
const IcoTruck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const IcoPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IcoCamera = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const IcoDoc = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IcoShip = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 21c.6.5 1.2 1 2.4 1 2.4 0 2.4-2 4.8-2 2.4 0 2.4 2 4.8 2 2.4 0 2.4-2 4.8-2 1.2 0 1.8.5 2.4 1"/>
    <path d="M19 13V7l-3-2H8L5 7v6"/><path d="M12 3v4"/><path d="M5 13H2l2.5 5h15L22 13h-3"/>
  </svg>
);
const IcoFlag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
);
const IcoCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IcoArrow = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IcoRefresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IcoWA = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);
const IcoSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IcoMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const IcoMapPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

const STAGE_ICONS = {
  asal: <IcoCamera />, kapal: <IcoShip />, tujuan: <IcoFlag />, dokumen: <IcoDoc />,
};

const Logo = ({ size = 40 }) => (
  <img src="/logo.png" alt="PT Alyssa Auto Logistik" width={size} height={size} style={{ objectFit: "contain" }} />
);

function useDarkMode() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark"
  );
  const toggle = useCallback(() => {
    const next = !dark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("aal-theme", next ? "dark" : "light"); } catch (_) {}
    setDark(next);
  }, [dark]);
  return [dark, toggle];
}

const STATUS_COLOR = {
  "Sudah Diterima":  "green",
  "Tiba di Tujuan":  "green",
  "Sedang Dikirim":  "blue",
  "Siap Berangkat":  "amber",
  "Persiapan":       "gray",
};

function getOverallStatus(data) {
  const progress = data.progress || {};
  const legs = data.legs || [];
  const lastLeg = legs[legs.length - 1];
  if (progress.handover_complete) return "Sudah Diterima";
  if (lastLeg?.status === "Delivered") return "Tiba di Tujuan";
  if (legs.some((l) => /jalan|kapal|berangkat|laut|feri/i.test(l.status || ""))) return "Sedang Dikirim";
  if (progress.initial_complete) return "Siap Berangkat";
  return "Persiapan";
}

/* ── Custom Leaflet marker ── */
function createCpIcon(num, isLatest, dark) {
  const bg = isLatest ? "#E11D48" : "#2563EB";
  const ring = isLatest ? "rgba(225,29,72,0.3)" : "transparent";
  return L.divIcon({
    html: `
      <div style="
        width:30px;height:30px;
        border-radius:50%;
        background:${bg};
        color:#fff;
        font-family:Inter,sans-serif;
        font-size:11px;
        font-weight:800;
        display:flex;align-items:center;justify-content:center;
        border:2.5px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.28),0 0 0 ${isLatest ? "6px" : "0"} ${ring};
        ${isLatest ? "animation:cpPulse 2s ease-in-out infinite;" : ""}
      ">${num}</div>
    `,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

/* ── Map auto-fit ── */
function MapFitter({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [48, 48] });
    }
  }, [map, positions]);
  return null;
}

/* ── Main ── */
export default function CustomerTracking() {
  const tripId = useMemo(readTripId, []);
  const [dark, toggleDark] = useDarkMode();
  const [data, setData] = useState(null);
  const [stage, setStage] = useState("asal");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCp, setSelectedCp] = useState(null);
  const panelRef = useRef(null);

  const fetchData = useCallback(async (showSpinner = false) => {
    if (!tripId) { setError("not_found"); setLoading(false); return; }
    if (showSpinner) setRefreshing(true);
    try {
      const r = await axios.get(`${API}/public/trips/${tripId}`);
      setData(r.data);
      setLastUpdate(new Date());
    } catch {
      setError("not_found");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchData();
    const t = setInterval(() => fetchData(), 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  /* ── Loading ── */
  if (loading) return (
    <div className="trk-root trk-loading-screen">
      <div className="trk-loading-inner">
        <Logo size={56} />
        <div className="trk-loading-spinner" />
        <div className="trk-loading-text">Memuat data perjalanan...</div>
      </div>
    </div>
  );

  /* ── Not found ── */
  if (error) return (
    <div className="trk-root">
      <header className="trk-topbar">
        <div className="trk-topbar-inner">
          <a href="/" className="trk-brand">
            <Logo size={38} />
            <div className="trk-brand-text">
              <div className="trk-brand-title">Fleet / Live Track</div>
              <div className="trk-brand-sub">PT Alyssa Auto Logistik</div>
            </div>
          </a>
          <button className="trk-icon-btn" onClick={toggleDark}>{dark ? <IcoSun /> : <IcoMoon />}</button>
        </div>
      </header>
      <div className="trk-notfound">
        <div className="trk-notfound-ico">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="12"/><line x1="11" y1="16" x2="11.01" y2="16"/>
          </svg>
        </div>
        <h2 className="trk-notfound-title">Pengiriman Tidak Ditemukan</h2>
        <p className="trk-notfound-p">
          {tripId ? `Kode "${tripId}" tidak ditemukan.` : "Kode resi tidak disertakan."}
        </p>
        <div className="trk-notfound-actions">
          <a href="/" className="trk-btn trk-btn-ghost">Beranda</a>
          <a href="https://wa.me/628186311350" target="_blank" rel="noreferrer" className="trk-btn trk-btn-wa">
            <IcoWA /> Hubungi Admin
          </a>
        </div>
      </div>
    </div>
  );

  if (!data) return null;

  const album      = data.album || { asal: [], kapal: [], tujuan: [], dokumen: [] };
  const legs       = data.legs || [];
  const progress   = data.progress || {};
  const daily      = data.daily_checkpoints || [];
  const overallStatus = getOverallStatus(data);
  const statusColor   = STATUS_COLOR[overallStatus] || "gray";

  /* GPS-enabled checkpoints */
  const gpsPoints = daily
    .map((cp, i) => ({ ...cp, _idx: i }))
    .filter((cp) => cp.lat != null && cp.lng != null);

  const positions = gpsPoints.map((cp) => [parseFloat(cp.lat), parseFloat(cp.lng)]);
  const lastGps   = gpsPoints[gpsPoints.length - 1];
  const hasMap    = gpsPoints.length > 0;

  /* CartoDB tiles: professional light/dark */
  const tileUrl = dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const tileAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const defaultCenter = [-2.5, 118.0];

  const waUrl = `https://wa.me/628186311350?text=${encodeURIComponent(`Halo Admin Alyssa, saya ingin menanyakan status pengiriman saya.\nTrip ID: ${tripId}`)}`;

  return (
    <div className={`trk-root trk-fleet${dark ? " trk-dark" : ""}`}>

      {/* ── Topbar ── */}
      <header className="trk-topbar">
        <div className="trk-topbar-inner">
          <a href="/" className="trk-brand">
            <Logo size={36} />
            <div className="trk-brand-text">
              <div className="trk-brand-title">Fleet / Live Track</div>
              <div className="trk-brand-sub">Driver Checkpoint Console</div>
            </div>
          </a>
          <div className="trk-topbar-right">
            <div className="trk-clock-chip" data-testid="trk-clock">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="trk-clock-time" id="trk-live-time">
                {lastUpdate
                  ? lastUpdate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "--:--:--"}
              </span>
              <span className="trk-clock-sep">|</span>
              <span>{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <button
              className={`trk-icon-btn${refreshing ? " trk-spinning" : ""}`}
              onClick={() => fetchData(true)}
              disabled={refreshing}
              aria-label="Refresh"
            >
              <IcoRefresh />
            </button>
            <button className="trk-icon-btn" onClick={toggleDark} aria-label="Ganti tema">
              {dark ? <IcoSun /> : <IcoMoon />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main layout: map + panel ── */}
      <div className="trk-layout">

        {/* MAP */}
        <div className="trk-map-area">
          {hasMap ? (
            <MapContainer
              center={lastGps ? [parseFloat(lastGps.lat), parseFloat(lastGps.lng)] : defaultCenter}
              zoom={12}
              className="trk-leaflet-map"
              zoomControl={true}
              attributionControl={true}
            >
              <TileLayer url={tileUrl} attribution={tileAttr} maxZoom={19} />
              <MapFitter positions={positions} />

              {/* Route polyline */}
              {positions.length > 1 && (
                <Polyline
                  positions={positions}
                  pathOptions={{ color: "#2563EB", weight: 3, opacity: 0.7, dashArray: "8 6" }}
                />
              )}

              {/* Checkpoint markers */}
              {gpsPoints.map((cp, i) => {
                const isLatest = i === gpsPoints.length - 1;
                const icon = createCpIcon(i + 1, isLatest, dark);
                return (
                  <Marker
                    key={cp.id || i}
                    position={[parseFloat(cp.lat), parseFloat(cp.lng)]}
                    icon={icon}
                    eventHandlers={{ click: () => setSelectedCp(cp) }}
                  >
                    <Popup className="trk-popup" maxWidth={260}>
                      <div className="trk-popup-inner">
                        <div className="trk-popup-header">
                          <span className="trk-popup-num">CP-{i + 1}</span>
                          {isLatest && <span className="trk-popup-latest">Terakhir</span>}
                        </div>
                        {cp.url && (
                          <a href={resolveUrl(cp.url)} target="_blank" rel="noreferrer" className="trk-popup-photo-wrap">
                            <img src={resolveUrl(cp.url)} alt={`CP-${i + 1}`} className="trk-popup-photo" />
                          </a>
                        )}
                        <div className="trk-popup-meta">
                          <div className="trk-popup-time">{fmtTs(cp.ts || cp.timestamp || cp.created_at)}</div>
                          {data.nopol && <div className="trk-popup-nopol" style={{ fontWeight: 700 }}>🚚 {data.nopol}</div>}
                          {cp.status && <div className="trk-popup-status">{cp.status}</div>}
                          {cp.keterangan && <div className="trk-popup-note">{cp.keterangan}</div>}
                          <a
                            href={`https://www.google.com/maps?q=${parseFloat(cp.lat)},${parseFloat(cp.lng)}`}
                            target="_blank" rel="noreferrer"
                            className="trk-popup-coords"
                            style={{ textDecoration: "underline" }}
                          >
                            📍 {parseFloat(cp.lat).toFixed(5)}, {parseFloat(cp.lng).toFixed(5)} · Buka Maps
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          ) : (
            <div className="trk-map-empty">
              <div className="trk-map-empty-ico">
                <IcoMapPin />
              </div>
              <div className="trk-map-empty-title">Belum Ada Data GPS</div>
              <div className="trk-map-empty-sub">Peta akan muncul saat driver mengirim foto checkpoint dengan lokasi aktif.</div>
            </div>
          )}

          {/* Map overlay: GPS count badge */}
          {hasMap && (
            <div className="trk-map-badge">
              <IcoPin />
              <span>
                {lastGps
                  ? `${parseFloat(lastGps.lat).toFixed(4)}, ${parseFloat(lastGps.lng).toFixed(4)}`
                  : "—"}
              </span>
            </div>
          )}
        </div>

        {/* PANEL */}
        <div className="trk-panel" ref={panelRef}>

          {/* Vehicle info */}
          <div className="trk-panel-vehicle" data-testid="trk-vehicle">
            <div className="trk-panel-label">NOMOR POLISI</div>
            <div className="trk-panel-nopol" data-testid="trk-nopol">{data.nopol || "—"}</div>
            <div className="trk-panel-rows">
              {data.nama_driver && (
                <div className="trk-panel-row">
                  <span className="trk-panel-k">Driver</span>
                  <span className="trk-panel-v">{data.nama_driver}</span>
                </div>
              )}
              {data.route && (
                <div className="trk-panel-row">
                  <span className="trk-panel-k">Rute</span>
                  <span className="trk-panel-v">{data.route}</span>
                </div>
              )}
              {data.tipe_kendaraan && (
                <div className="trk-panel-row">
                  <span className="trk-panel-k">Muatan</span>
                  <span className="trk-panel-v">{data.tipe_kendaraan}</span>
                </div>
              )}
            </div>
            <div className={`trk-status-chip trk-status-${statusColor}`}>
              {overallStatus === "Sudah Diterima" || overallStatus === "Tiba di Tujuan"
                ? <IcoCheck /> : <span className="trk-pulse-dot" />}
              {overallStatus}
            </div>
          </div>

          {/* Checkpoint list */}
          <div className="trk-cp-section">
            <div className="trk-cp-header">
              <div className="trk-cp-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                </svg>
                Driver Checkpoint
              </div>
              <span className="trk-cp-count">{daily.length}</span>
            </div>

            {daily.length === 0 ? (
              <div className="trk-cp-empty">Belum ada checkpoint</div>
            ) : (
              <div className="trk-cp-list">
                {[...daily].reverse().map((cp, i, arr) => {
                  const cpNum = arr.length - i;
                  const isLatest = i === 0;
                  const hasGps = cp.lat != null && cp.lng != null;
                  return (
                    <div
                      key={cp.id || i}
                      className={`trk-cp-item${isLatest ? " trk-cp-latest" : ""}${selectedCp?.id === cp.id ? " trk-cp-selected" : ""}`}
                      onClick={() => setSelectedCp(selectedCp?.id === cp.id ? null : cp)}
                      data-testid={`trk-cp-${cpNum}`}
                    >
                      <div className={`trk-cp-dot${isLatest ? " trk-cp-dot-latest" : ""}`}>
                        {isLatest
                          ? <span className="trk-cp-dot-pulse" />
                          : <span>{cpNum}</span>}
                      </div>
                      <div className="trk-cp-body">
                        <div className="trk-cp-row">
                          <span className="trk-cp-name">CP-{cpNum}</span>
                          <span className="trk-cp-time">
                            {fmtTime(cp.ts || cp.timestamp || cp.created_at)} &bull; {fmtDate(cp.ts || cp.timestamp || cp.created_at)}
                          </span>
                        </div>
                        {data.nopol && (
                          <div className="trk-cp-nopol" style={{ fontWeight: 700, fontSize: 12, letterSpacing: ".3px", color: "var(--trk-accent, #2563eb)", marginTop: 2 }}>
                            🚚 {data.nopol}
                          </div>
                        )}
                        {hasGps ? (
                          <a
                            href={`https://www.google.com/maps?q=${parseFloat(cp.lat)},${parseFloat(cp.lng)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="trk-cp-coords"
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "underline", cursor: "pointer" }}
                          >
                            📍 {parseFloat(cp.lat).toFixed(5)}, {parseFloat(cp.lng).toFixed(5)} · Buka Maps
                          </a>
                        ) : (
                          <div className="trk-cp-coords" style={{ opacity: .7 }}>📍 Lokasi GPS tidak aktif</div>
                        )}
                        {cp.status && <div className="trk-cp-status">{cp.status}</div>}
                        {cp.keterangan && <div className="trk-cp-note">{cp.keterangan}</div>}
                        {/* Thumbnail */}
                        {selectedCp?.id === cp.id && cp.url && (
                          <a
                            href={resolveUrl(cp.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="trk-cp-thumb-wrap"
                          >
                            <img src={resolveUrl(cp.url)} alt={`CP-${cpNum}`} className="trk-cp-thumb" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legs */}
          {legs.length > 0 && (
            <div className="trk-legs-section">
              <div className="trk-section-title"><IcoPin /> Rute Pengiriman</div>
              {legs.map((leg, i) => {
                const st = (leg.status || "").toLowerCase();
                const isDone = /delivered|selesai|tiba/.test(st);
                const isActive = /jalan|berangkat|kapal|laut|feri/.test(st);
                return (
                  <div key={i} className={`trk-leg${isDone ? " trk-leg-done" : isActive ? " trk-leg-active" : ""}`}>
                    <div className="trk-leg-num">{i + 1}</div>
                    <div className="trk-leg-body">
                      <div className="trk-leg-route">
                        <span>{leg.asal || "?"}</span>
                        <IcoArrow />
                        <span>{leg.tujuan || "?"}</span>
                      </div>
                      {leg.jalur && <div className="trk-leg-jalur">{leg.jalur}</div>}
                      {leg.kapal && <div className="trk-leg-kapal"><IcoShip /> {leg.kapal}</div>}
                    </div>
                    <span className={`trk-leg-badge${isDone ? " ok" : isActive ? " active" : ""}`}>
                      {leg.status || "Menunggu"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Foto Kondisi Awal Kendaraan */}
          {(() => {
            const initial = data.initial_photos || {};
            const SLOT_LABELS = {
              depan: "Tampak Depan", belakang: "Tampak Belakang",
              kiri: "Sisi Kiri", kanan: "Sisi Kanan", spidometer: "Dashboard",
            };
            const slots = ["depan", "belakang", "kiri", "kanan", "spidometer"].filter(s => initial[s]?.url);
            if (slots.length === 0) return null;
            return (
              <div className="trk-album-section">
                <div className="trk-section-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  Foto Kondisi Kendaraan
                </div>
                <div className="trk-album-grid">
                  {slots.map(s => (
                    <a key={s} href={resolveUrl(initial[s].url)} target="_blank" rel="noreferrer" className="trk-album-item">
                      <img src={resolveUrl(initial[s].url)} alt={SLOT_LABELS[s]} loading="lazy" />
                      <div className="trk-album-caption">{SLOT_LABELS[s]}</div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Album */}
          <div className="trk-album-section">
            <div className="trk-section-title"><IcoCamera /> Album Perjalanan</div>
            <div className="trk-album-tabs">
              {ALBUM_STAGES.map((s) => (
                <button
                  key={s}
                  className={`trk-album-tab${stage === s ? " active" : ""}`}
                  onClick={() => setStage(s)}
                  data-testid={`trk-tab-${s}`}
                >
                  {STAGE_ICONS[s]}
                  <span>{stageLabel(s)}</span>
                  <span className="trk-tab-count">{(album[s] || []).length}</span>
                </button>
              ))}
            </div>
            {(album[stage] || []).length === 0 ? (
              <div className="trk-album-empty">Belum ada foto {stageLabel(stage)}</div>
            ) : (
              <div className="trk-album-grid">
                {(album[stage] || []).map((p) => {
                  const isPdf = (p.url || "").toLowerCase().endsWith(".pdf");
                  return (
                    <a key={p.id} href={resolveUrl(p.url)} target="_blank" rel="noreferrer"
                      className="trk-album-item" data-testid={`trk-item-${p.id}`}>
                      {isPdf
                        ? <div className="trk-pdf-thumb">PDF</div>
                        : <img src={resolveUrl(p.url)} alt={stage} loading="lazy" />}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Handover */}
          {(data.handover?.bastk?.length || data.handover?.resi) && (
            <div className="trk-handover-section">
              <div className="trk-section-title"><IcoDoc /> Berkas Serah Terima</div>
              {(data.handover?.bastk || []).length > 0 && (
                <>
                  <div className="trk-handover-label">BASTK ({(data.handover.bastk || []).length} lembar)</div>
                  <div className="trk-album-grid" style={{ marginBottom: 12 }}>
                    {(data.handover.bastk || []).map((b) => {
                      const isPdf = (b.url || "").toLowerCase().endsWith(".pdf");
                      return (
                        <a key={b.id} href={resolveUrl(b.url)} target="_blank" rel="noreferrer" className="trk-album-item">
                          {isPdf ? <div className="trk-pdf-thumb">PDF</div> : <img src={resolveUrl(b.url)} alt="bastk" loading="lazy" />}
                        </a>
                      );
                    })}
                  </div>
                </>
              )}
              {data.handover?.resi && (
                <>
                  <div className="trk-handover-label">Foto Resi Pengiriman</div>
                  <div className="trk-album-grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                    <a href={resolveUrl(data.handover.resi.url)} target="_blank" rel="noreferrer" className="trk-album-item">
                      {(data.handover.resi.url || "").toLowerCase().endsWith(".pdf")
                        ? <div className="trk-pdf-thumb">PDF</div>
                        : <img src={resolveUrl(data.handover.resi.url)} alt="resi" loading="lazy" />}
                    </a>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="trk-panel-footer">
            <a href={waUrl} target="_blank" rel="noreferrer" className="trk-btn trk-btn-wa">
              <IcoWA /> Hubungi Admin via WhatsApp
            </a>
            {lastUpdate && (
              <div className="trk-last-update">
                Diperbarui: {lastUpdate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                {" · "}Auto-refresh 30 dtk
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

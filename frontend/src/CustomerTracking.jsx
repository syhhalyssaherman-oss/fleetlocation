import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import "./Tracking.css";
import PoDCard from "./PoDCard";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ALBUM_STAGES = ["asal", "kapal", "tujuan", "dokumen"];

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

/* ── Icons ── */
const IcoTruck = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const IcoPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IcoCamera = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const IcoDoc = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IcoShip = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 21c.6.5 1.2 1 2.4 1 2.4 0 2.4-2 4.8-2 2.4 0 2.4 2 4.8 2 2.4 0 2.4-2 4.8-2 1.2 0 1.8.5 2.4 1"/>
    <path d="M19 13V7l-3-2H8L5 7v6"/><path d="M12 3v4"/><path d="M5 13H2l2.5 5h15L22 13h-3"/>
  </svg>
);
const IcoFlag = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
);
const IcoCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IcoArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IcoMoon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const STAGE_ICONS = {
  asal: <IcoCamera />, kapal: <IcoShip />, tujuan: <IcoFlag />, dokumen: <IcoDoc />,
};

/* ── Inline Logo ── */
const Logo = ({ size = 44 }) => (
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

/* ── Status helpers ── */
const STATUS_COLOR = {
  "Sudah Diterima":  "green",
  "Tiba di Tujuan":  "green",
  "Sedang Dikirim":  "blue",
  "Siap Berangkat":  "yellow",
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

/* ── Main component ── */
export default function CustomerTracking() {
  const tripId = useMemo(readTripId, []);
  const [dark, toggleDark] = useDarkMode();
  const [data, setData] = useState(null);
  const [stage, setStage] = useState("asal");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="trk-root">
      <header className="trk-hdr">
        <div className="trk-hdr-inner">
          <div className="trk-brand">
            <div className="trk-skel" style={{ width: 44, height: 48, borderRadius: 8 }} />
            <div>
              <div className="trk-skel" style={{ width: 160, height: 14, marginBottom: 6 }} />
              <div className="trk-skel" style={{ width: 110, height: 11 }} />
            </div>
          </div>
        </div>
      </header>
      <div className="trk-body">
        <div className="trk-skel" style={{ height: 100, borderRadius: 16, marginBottom: 16 }} />
        <div className="trk-skel" style={{ height: 80, borderRadius: 16, marginBottom: 16 }} />
        <div className="trk-skel" style={{ height: 140, borderRadius: 16, marginBottom: 16 }} />
        <div className="trk-skel" style={{ height: 200, borderRadius: 16 }} />
      </div>
    </div>
  );

  /* ── Not found ── */
  if (error) return (
    <div className="trk-root">
      <header className="trk-hdr">
        <div className="trk-hdr-inner">
          <a href="/" className="trk-brand">
            <Logo size={44} />
            <div>
              <div className="trk-brand-name">Tracking Pengiriman</div>
              <div className="trk-brand-sub">PT Alyssa Auto Logistik</div>
            </div>
          </a>
          <button className="trk-theme" onClick={toggleDark}>{dark ? <IcoSun /> : <IcoMoon />}</button>
        </div>
      </header>
      <div className="trk-notfound">
        <div className="trk-notfound-ico">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="12"/><line x1="11" y1="16" x2="11.01" y2="16"/>
          </svg>
        </div>
        <h2 className="trk-notfound-title">Pengiriman Tidak Ditemukan</h2>
        <p className="trk-notfound-p">
          {tripId
            ? `Kode "${tripId}" tidak ditemukan dalam sistem kami.`
            : "Kode resi tidak disertakan dalam link ini."}
        </p>
        <p className="trk-notfound-p">Pastikan kode resi benar atau hubungi admin untuk bantuan.</p>
        <div className="trk-notfound-actions">
          <a href="/" className="trk-btn trk-btn--ghost"><IcoArrow style={{ transform: "rotate(180deg)" }} /> Beranda</a>
          <a href="https://wa.me/628186311350" target="_blank" rel="noreferrer" className="trk-btn trk-btn--wa">
            <IcoWA /> Hubungi via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );

  if (!data) return null;

  const album   = data.album || { asal: [], kapal: [], tujuan: [], dokumen: [] };
  const legs    = data.legs || [];
  const progress = data.progress || {};
  const overallStatus = getOverallStatus(data);
  const statusColor   = STATUS_COLOR[overallStatus] || "gray";

  return (
    <div className="trk-root">
      {/* ── Header ── */}
      <header className="trk-hdr">
        <div className="trk-hdr-inner">
          <a href="/" className="trk-brand">
            <Logo size={44} />
            <div>
              <div className="trk-brand-name">Tracking Pengiriman</div>
              <div className="trk-brand-sub">PT Alyssa Auto Logistik</div>
            </div>
          </a>
          <div className="trk-hdr-right">
            <button
              className="trk-refresh-btn"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              aria-label="Refresh"
            >
              <span className={refreshing ? "trk-spin" : ""}><IcoRefresh /></span>
            </button>
            <button className="trk-theme" onClick={toggleDark} aria-label="Ganti tema">
              {dark ? <IcoSun /> : <IcoMoon />}
            </button>
          </div>
        </div>
      </header>

      <div className="trk-body">
        {/* ── Status banner ── */}
        <div className={`trk-banner trk-banner--${statusColor}`} data-testid="trk-banner">
          <div className="trk-banner-left">
            <div className="trk-banner-vehicle">
              <span className="trk-banner-ico"><IcoTruck /></span>
              <div>
                <div className="trk-nopol" data-testid="trk-nopol">{data.nopol || "—"}</div>
                {data.tipe_kendaraan && (
                  <div className="trk-tipe">
                    {data.tipe_kendaraan}
                    {data.no_rangka && <span className="trk-rangka"> · {data.no_rangka}</span>}
                  </div>
                )}
                {data.route && (
                  <div className="trk-route">
                    <IcoPin /> {data.route}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="trk-banner-right">
            <div className={`trk-status-badge trk-status-badge--${statusColor}`}>
              {overallStatus === "Sudah Diterima" || overallStatus === "Tiba di Tujuan"
                ? <IcoCheck />
                : <span className={`trk-pulse trk-pulse--${statusColor}`} />
              }
              {overallStatus}
            </div>
            {data.nama_driver && (
              <div className="trk-driver-lbl">
                Driver: <strong>{data.nama_driver}</strong>
              </div>
            )}
          </div>
        </div>

        {/* ── Progress tiles ── */}
        <div className="trk-progress-row" data-testid="trk-progress">
          <ProgressTile
            icon={<IcoCamera />}
            label="Foto Awal"
            value={`${data.initial_done ?? 0}/5`}
            ok={progress.initial_complete}
          />
          <ProgressTile
            icon={<IcoTruck />}
            label="Checkpoint"
            value={String(data.daily_count ?? 0)}
            ok={(data.daily_count ?? 0) > 0}
          />
          <ProgressTile
            icon={<IcoDoc />}
            label="Serah Terima"
            value={progress.handover_complete ? "Selesai" : "Proses"}
            ok={progress.handover_complete}
          />
        </div>

        {/* ── Legs / Route ── */}
        {legs.length > 0 && (
          <section className="trk-card" data-testid="trk-legs">
            <div className="trk-card-hd">
              <IcoPin /> Rute Pengiriman
            </div>
            <div className="trk-legs">
              {legs.map((leg, i) => {
                const st = (leg.status || "menunggu").toLowerCase();
                const isDone = /delivered|selesai|tiba/.test(st);
                const isActive = /jalan|berangkat|kapal|laut|feri/.test(st);
                return (
                  <div key={i} className={`trk-leg${isDone ? " trk-leg--done" : isActive ? " trk-leg--active" : ""}`}>
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
          </section>
        )}

        {/* ── Proof of Delivery ── */}
        {(data.daily_checkpoints || []).length > 0 && (
          <section className="trk-card" data-testid="trk-pod-list">
            <div className="trk-card-hd">
              <IcoDoc /> Proof of Delivery
              <span className="trk-count-badge">{(data.daily_checkpoints || []).length} checkpoint</span>
            </div>
            <div className="trk-pod-list">
              {[...(data.daily_checkpoints || [])].reverse().map((cp, i, arr) => (
                <PoDCard
                  key={cp.id}
                  photo={cp}
                  backendUrl={BACKEND_URL}
                  namaDriver={data.nama_driver}
                  nopol={data.nopol}
                  dayIndex={arr.length - 1 - i}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Album foto ── */}
        <section className="trk-card" data-testid="trk-album">
          <div className="trk-card-hd">
            <IcoCamera /> Album Perjalanan
            <span className="trk-count-badge">{(album[stage] || []).length} foto</span>
          </div>
          <div className="trk-tabs">
            {ALBUM_STAGES.map((s) => (
              <button
                key={s}
                className={`trk-tab${stage === s ? " trk-tab--active" : ""}`}
                onClick={() => setStage(s)}
                data-testid={`trk-tab-${s}`}
              >
                {STAGE_ICONS[s]}
                <span>{stageLabel(s)}</span>
                <span className="trk-tab-count">{(album[s] || []).length}</span>
              </button>
            ))}
          </div>
          <div className="trk-album-body">
            {(album[stage] || []).length === 0 ? (
              <div className="trk-album-empty">
                <span className="trk-album-empty-ico">{STAGE_ICONS[stage]}</span>
                Belum ada foto {stageLabel(stage)}
              </div>
            ) : (
              <div className="trk-album-grid">
                {(album[stage] || []).map((p) => {
                  const isPdf = (p.url || "").toLowerCase().endsWith(".pdf");
                  return (
                    <a key={p.id} href={`${BACKEND_URL}${p.url}`} target="_blank" rel="noreferrer"
                      className="trk-album-item" data-testid={`trk-item-${p.id}`}>
                      {isPdf
                        ? <div className="trk-pdf-thumb">PDF</div>
                        : <img src={`${BACKEND_URL}${p.url}`} alt={stage} loading="lazy" />}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Handover documents ── */}
        {(data.handover?.bastk?.length || data.handover?.resi) && (
          <section className="trk-card" data-testid="trk-handover">
            <div className="trk-card-hd"><IcoDoc /> Berkas Serah Terima</div>
            <div className="trk-handover-body">
              {(data.handover?.bastk || []).length > 0 && (
                <>
                  <div className="trk-handover-label">
                    BASTK ({(data.handover.bastk || []).length} lembar)
                  </div>
                  <div className="trk-album-grid" style={{ marginBottom: 16 }}>
                    {(data.handover.bastk || []).map((b) => {
                      const isPdf = (b.url || "").toLowerCase().endsWith(".pdf");
                      return (
                        <a key={b.id} href={`${BACKEND_URL}${b.url}`} target="_blank" rel="noreferrer" className="trk-album-item">
                          {isPdf ? <div className="trk-pdf-thumb">PDF</div> : <img src={`${BACKEND_URL}${b.url}`} alt="bastk" loading="lazy" />}
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
                    <a href={`${BACKEND_URL}${data.handover.resi.url}`} target="_blank" rel="noreferrer" className="trk-album-item">
                      {(data.handover.resi.url || "").toLowerCase().endsWith(".pdf")
                        ? <div className="trk-pdf-thumb">PDF</div>
                        : <img src={`${BACKEND_URL}${data.handover.resi.url}`} alt="resi" loading="lazy" />}
                    </a>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <div className="trk-footer">
          <div className="trk-footer-brand">PT Alyssa Auto Logistik</div>
          <div className="trk-footer-sub">
            Hubungi <strong>0818 631 135</strong> untuk informasi lebih lanjut
          </div>
          {lastUpdate && (
            <div className="trk-footer-update">
              Terakhir diperbarui: {lastUpdate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              {" · "}Auto-refresh tiap 30 detik
            </div>
          )}
          <a href="https://wa.me/628186311350" target="_blank" rel="noreferrer" className="trk-btn trk-btn--wa" style={{ marginTop: 12 }}>
            <IcoWA /> Hubungi via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function ProgressTile({ icon, label, value, ok }) {
  return (
    <div className={`trk-prog-tile${ok ? " trk-prog-tile--ok" : ""}`}>
      <div className="trk-prog-ico">{icon}</div>
      <div className="trk-prog-val">{value}</div>
      <div className="trk-prog-lbl">{label}</div>
    </div>
  );
}

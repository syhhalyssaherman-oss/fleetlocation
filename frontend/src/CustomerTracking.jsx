import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import "@/App.css";
import "@/Driver.css";
import PoDCard from "@/PoDCard";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const ALBUM_STAGES = ["asal", "kapal", "tujuan", "dokumen"];

function stageLabel(s) {
  return { asal: "Asal", kapal: "Dalam Kapal", tujuan: "Tujuan", dokumen: "Dokumen" }[s] || s;
}
function stageIcon(s) {
  return { asal: "🏁", kapal: "⛴️", tujuan: "📍", dokumen: "📄" }[s] || "📷";
}

function readTrackId() {
  const u = new URL(window.location.href);
  return u.searchParams.get("track") || "";
}

function fmtTs(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function CustomerTracking() {
  const tripId = useMemo(readTrackId, []);
  const [data, setData] = useState(null);
  const [stage, setStage] = useState("asal");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      setError("Link tidak valid. Hubungi admin AAL.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await axios.get(`${API}/public/trips/${tripId}`);
        if (!cancelled) setData(r.data);
      } catch (e) {
        if (!cancelled) setError("Data perjalanan tidak ditemukan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOnce();
    const t = setInterval(fetchOnce, 30000); // refresh tiap 30 detik
    return () => { cancelled = true; clearInterval(t); };
  }, [tripId]);

  if (loading) return <div className="drv-loading">Memuat status pengiriman…</div>;
  if (error)   return <div className="drv-error" data-testid="trk-error">{error}</div>;
  if (!data)   return <div className="drv-error">Data tidak ditemukan.</div>;

  const album = data.album || { asal: [], kapal: [], tujuan: [], dokumen: [] };
  const legs = data.legs || [];
  const progress = data.progress || {};
  const lastLeg = legs[legs.length - 1];
  const overallStatus =
    progress.handover_complete ? "Sudah Diterima" :
    (lastLeg?.status === "Delivered" ? "Tiba di Tujuan" :
    (legs.some((l) => /jalan|kapal|berangkat|laut|feri/i.test(l.status||"")) ? "Sedang Dikirim" :
    (progress.initial_complete ? "Siap Berangkat" : "Persiapan"))
  );

  return (
    <div className="drv-root" data-testid="trk-root">
      <header className="drv-header">
        <div className="drv-brand">
          <div className="drv-brand-mark">AAL</div>
          <div>
            <div className="drv-brand-name">Tracking Pengiriman</div>
            <div className="drv-brand-sub">Alyssa Auto Logistik</div>
          </div>
        </div>
        <div className="drv-clock">
          <span className="drv-clock-time" style={{ fontSize: 13 }}>{overallStatus}</span>
          <span className="drv-clock-date">Update: {fmtTs(data.updated_at)}</span>
        </div>
      </header>

      <section className="drv-trip-banner" data-testid="trk-banner">
        <div className="drv-nopol-wrap">
          <div className="drv-nopol-lbl">Nomor Polisi</div>
          <div className="drv-nopol" data-testid="trk-nopol">{data.nopol}</div>
          {data.tipe_kendaraan && (
            <div className="drv-tipe">
              {data.tipe_kendaraan}
              {data.no_rangka && <span className="drv-rangka"> · {data.no_rangka}</span>}
            </div>
          )}
          {data.route && <div className="drv-route">📍 {data.route}</div>}
        </div>
        <div className="drv-greet">
          <div className="drv-greet-lbl">Driver</div>
          <div className="drv-greet-name">{data.nama_driver || "—"}</div>
        </div>
      </section>

      {/* Progress overview */}
      <section className="drv-card" data-testid="trk-progress">
        <div className="drv-card-head"><span>📊 Status Pengiriman</span></div>
        <div className="drv-card-body">
          <div className="trk-progress-grid">
            <ProgressTile lbl="Foto Awal" val={`${data.initial_done}/5`} ok={progress.initial_complete} />
            <ProgressTile lbl="Checkpoint Harian" val={`${data.daily_count}`} ok={data.daily_count > 0} />
            <ProgressTile lbl="BASTK + Resi" val={progress.handover_complete ? "Lengkap" : "Belum"} ok={progress.handover_complete} />
          </div>
        </div>
      </section>

      {/* Rute */}
      {legs.length > 0 && (
        <section className="drv-card" data-testid="trk-legs">
          <div className="drv-card-head"><span>🛣️ Rute Pengiriman</span></div>
          <div className="drv-card-body drv-legs">
            {legs.map((leg, i) => (
              <div key={i} className="drv-leg-row">
                <div className="drv-leg-num">{i + 1}</div>
                <div className="drv-leg-info">
                  <div className="drv-leg-jalur">{leg.jalur || "—"}</div>
                  <div className="drv-leg-route">
                    <span>{leg.asal || "?"}</span>
                    <span className="drv-leg-arrow">→</span>
                    <span>{leg.tujuan || "?"}</span>
                  </div>
                  {leg.kapal && <div className="drv-leg-vendor">{leg.kapal}</div>}
                </div>
                <span className={`drv-leg-status drv-leg-status-${(leg.status||"menunggu").toLowerCase().replace(/\s+/g,"-")}`}>
                  {leg.status || "Menunggu"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Proof of Delivery (daily checkpoint cards) */}
      {(data.daily_checkpoints || []).length > 0 && (
        <section className="drv-card" data-testid="trk-pod-list">
          <div className="drv-card-head">
            <span>📋 Proof of Delivery</span>
            <span className="drv-pill drv-pill-ok">{(data.daily_checkpoints || []).length} checkpoint</span>
          </div>
          <div className="drv-card-body drv-pod-list">
            {[...(data.daily_checkpoints || [])].slice().reverse().map((cp, i, arr) => (
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

      {/* Album foto */}
      <section className="drv-card" data-testid="trk-album">
        <div className="drv-card-head">
          <span>🗂️ Album Perjalanan</span>
          <span className="drv-pill drv-pill-ready">{(album[stage] || []).length} foto</span>
        </div>
        <div className="drv-album-tabs">
          {ALBUM_STAGES.map((s) => (
            <button
              key={s}
              className={`drv-album-tab ${stage === s ? "active" : ""}`}
              onClick={() => setStage(s)}
              data-testid={`trk-tab-${s}`}
            >
              <span className="drv-album-tab-ico">{stageIcon(s)}</span>
              <span>{stageLabel(s)}</span>
              <span className="drv-album-tab-count">{(album[s] || []).length}</span>
            </button>
          ))}
        </div>
        <div className="drv-card-body">
          {(album[stage] || []).length === 0 ? (
            <div className="drv-album-empty">
              <div style={{ fontSize: 38, opacity: 0.5 }}>{stageIcon(stage)}</div>
              <div>Belum ada foto {stageLabel(stage)}.</div>
            </div>
          ) : (
            <div className="drv-album-grid">
              {(album[stage] || []).map((p) => {
                const isPdf = (p.url || "").toLowerCase().endsWith(".pdf");
                return (
                  <a key={p.id} href={`${BACKEND_URL}${p.url}`} target="_blank" rel="noreferrer" className="drv-album-item" data-testid={`trk-item-${p.id}`}>
                    {isPdf
                      ? <div className="drv-doc-pdf">PDF</div>
                      : <img src={`${BACKEND_URL}${p.url}`} alt={stage} />}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Dokumen serah terima (BASTK + Resi terpisah) */}
      {(data.handover?.bastk?.length || data.handover?.resi) && (
        <section className="drv-card" data-testid="trk-handover">
          <div className="drv-card-head"><span>📄 Berkas Serah Terima</span></div>
          <div className="drv-card-body">
            <div className="drv-handover-title">BASTK ({(data.handover?.bastk || []).length} lembar)</div>
            <div className="drv-album-grid" style={{ marginBottom: 14 }}>
              {(data.handover?.bastk || []).map((b) => {
                const isPdf = (b.url || "").toLowerCase().endsWith(".pdf");
                return (
                  <a key={b.id} href={`${BACKEND_URL}${b.url}`} target="_blank" rel="noreferrer" className="drv-album-item">
                    {isPdf ? <div className="drv-doc-pdf">PDF</div> : <img src={`${BACKEND_URL}${b.url}`} alt="bastk" />}
                  </a>
                );
              })}
            </div>
            {data.handover?.resi && (
              <>
                <div className="drv-handover-title">Foto Resi Pengiriman</div>
                <div className="drv-album-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                  <a href={`${BACKEND_URL}${data.handover.resi.url}`} target="_blank" rel="noreferrer" className="drv-album-item">
                    {(data.handover.resi.url || "").toLowerCase().endsWith(".pdf")
                      ? <div className="drv-doc-pdf">PDF</div>
                      : <img src={`${BACKEND_URL}${data.handover.resi.url}`} alt="resi" />}
                  </a>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <footer className="drv-footer">
        PT Alyssa Auto Logistik · 0818 631 135<br/>
        <span style={{ opacity: 0.55 }}>Halaman ini auto-refresh tiap 30 detik. Hubungi admin untuk info lebih lanjut.</span>
      </footer>
    </div>
  );
}

function ProgressTile({ lbl, val, ok }) {
  return (
    <div className={`trk-tile ${ok ? "trk-tile-ok" : ""}`}>
      <div className="trk-tile-val">{val}</div>
      <div className="trk-tile-lbl">{lbl}</div>
    </div>
  );
}

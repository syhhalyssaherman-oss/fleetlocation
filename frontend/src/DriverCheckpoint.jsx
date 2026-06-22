import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import "@/App.css";
import "@/Driver.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ID_MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const ID_DAYS = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

const SLOT_LABELS = {
  depan: "Tampak Depan",
  belakang: "Tampak Belakang",
  kiri: "Sisi Kiri",
  kanan: "Sisi Kanan",
  spidometer: "Spidometer",
  bbm: "Jarum BBM",
};
const SLOT_ORDER = ["depan", "belakang", "kiri", "kanan", "spidometer", "bbm"];

const SOP_TEXT = [
  "1. Periksa kondisi kendaraan SEBELUM berangkat: ban, oli, air radiator, BBM, rem.",
  "2. Bawa STNK, SIM, dan dokumen serah terima. Jangan tinggalkan di mobil saat ditinggal.",
  "3. Patuhi rambu lalu lintas. JANGAN ngebut. Maksimal 80 km/jam di jalan tol.",
  "4. Wajib upload 6 foto awal: 4 sisi mobil + spidometer + jarum BBM SEBELUM jalan.",
  "5. Setiap hari jam 06.00–12.00 WIB upload 1 foto depan kendaraan (NoPol kelihatan). Bonus Rp 30.000/hari.",
  "6. Kalau rajin foto tiap hari sampai tiba, dapat BONUS KERAJINAN Rp 150.000.",
  "7. JANGAN bawa penumpang lain selain crew yang ditugaskan.",
  "8. JANGAN merokok di dalam kendaraan. Pelanggaran = potong uang jalan.",
  "9. Saat tiba: upload BASTK (max 6 lembar) + foto Resi pengiriman dokumen.",
  "10. Hubungi admin via WA kalau ada kendala: 0818-631-135.",
];

function pad(n) { return String(n).padStart(2, "0"); }
function fmtIDR(n) { return "Rp " + (Number(n)||0).toLocaleString("id-ID"); }
function albumStageLabel(s) {
  return { asal: "Asal", kapal: "Dalam Kapal", tujuan: "Tujuan", dokumen: "Dokumen" }[s] || s;
}
function albumStageIcon(s) {
  return { asal: "🏁", kapal: "⛴️", tujuan: "📍", dokumen: "📄" }[s] || "📷";
}
const ALBUM_STAGES = ["asal", "kapal", "tujuan", "dokumen"];
function todayIso() {
  // Tampilan tanggal lokal browser (WIB di mobile user)
  const d = new Date();
  return `${pad(d.getDate())} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function readURLParams() {
  const u = new URL(window.location.href);
  const q = u.searchParams;
  let legs = [];
  try {
    const raw = q.get("legs");
    if (raw) legs = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(legs)) legs = [];
  } catch { legs = []; }
  return {
    trip:   q.get("trip")   || "",
    driver: q.get("driver") || "",
    route:  q.get("route")  || "",
    nopol:  q.get("nopol")  || "",
    tipe:   q.get("tipe")   || "",
    rangka: q.get("rangka") || "",
    uj:     parseInt(q.get("uj")  || "0") || 0,
    t1:     parseInt(q.get("t1")  || "0") || 0,
    t2:     parseInt(q.get("t2")  || "0") || 0,
    t3:     parseInt(q.get("t3")  || "0") || 0,
    legs,
  };
}

export default function DriverCheckpoint() {
  const params = useMemo(readURLParams, []);
  const [now, setNow] = useState(new Date());
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [showSOP, setShowSOP] = useState(false);
  const [namaInput, setNamaInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [uploadingDaily, setUploadingDaily] = useState(false);
  const [uploadingBastk, setUploadingBastk] = useState(false);
  const [uploadingResi, setUploadingResi] = useState(false);
  const [cairingTahap, setCairingTahap] = useState(0);

  const fileRefs = useRef({});

  // Real-time clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Init trip on mount (idempotent)
  useEffect(() => {
    if (!params.trip || !params.nopol) {
      setError("Link tidak lengkap. Hubungi admin via WA 0818-631-135.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await axios.post(`${API}/trips/init`, {
          trip_id: params.trip,
          driver_id: params.driver,
          nopol: params.nopol,
          route: params.route,
          uj: params.uj,
          t1: params.t1,
          t2: params.t2,
          t3: params.t3,
          tipe_kendaraan: params.tipe,
          no_rangka: params.rangka,
          legs: params.legs,
        });
        setTrip(res.data);
      } catch (e) {
        setError("Gagal memuat data perjalanan. Coba refresh halaman.");
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  const showToast = (msg, type="ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const reload = async () => {
    if (!trip?.trip_id) return;
    try {
      const r = await axios.get(`${API}/trips/${trip.trip_id}`);
      setTrip(r.data);
    } catch {}
  };

  const submitNama = async () => {
    const n = namaInput.trim();
    if (!n) { showToast("Isi nama dulu ya", "err"); return; }
    setSavingName(true);
    try {
      const r = await axios.post(`${API}/trips/${trip.trip_id}/driver-name`, { nama: n });
      setTrip(r.data);
      showToast("Halo " + n + ", semangat ya!");
    } catch {
      showToast("Gagal simpan nama. Coba lagi.", "err");
    } finally { setSavingName(false); }
  };

  const markSOP = async () => {
    try {
      await axios.post(`${API}/trips/${trip.trip_id}/sop-read`);
      setTrip((t) => ({ ...t, sop_read: true }));
      setShowSOP(false);
      showToast("Mantap, SOP sudah dibaca!");
    } catch {}
  };

  const triggerFile = (key) => {
    const el = fileRefs.current[key];
    if (el) { el.value = ""; el.click(); }
  };

  const uploadInitial = async (slot, file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showToast("Foto terlalu besar (max 8MB)", "err"); return; }
    setUploadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append("slot", slot);
      fd.append("foto", file);
      const r = await axios.post(`${API}/trips/${trip.trip_id}/photos/initial`, fd);
      setTrip(r.data);
      showToast("Foto " + SLOT_LABELS[slot] + " tersimpan");
    } catch (e) {
      showToast("Upload gagal. Coba lagi.", "err");
    } finally { setUploadingSlot(null); }
  };

  const uploadDaily = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showToast("Foto terlalu besar (max 8MB)", "err"); return; }
    setUploadingDaily(true);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const r = await axios.post(`${API}/trips/${trip.trip_id}/photos/daily`, fd);
      setTrip(r.data);
      showToast("Checkpoint hari ini terkirim! Bonus Rp 30.000 diproses.");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Upload gagal";
      showToast(msg, "err");
    } finally { setUploadingDaily(false); }
  };

  const uploadBastk = async (file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { showToast("File terlalu besar (max 15MB)", "err"); return; }
    setUploadingBastk(true);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const r = await axios.post(`${API}/trips/${trip.trip_id}/photos/handover-bastk`, fd);
      setTrip(r.data);
      showToast("BASTK terupload");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Upload gagal";
      showToast(msg, "err");
    } finally { setUploadingBastk(false); }
  };

  const uploadResi = async (file) => {
    if (!file) return;
    setUploadingResi(true);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const r = await axios.post(`${API}/trips/${trip.trip_id}/photos/handover-resi`, fd);
      setTrip(r.data);
      showToast("Foto Resi terupload");
    } catch (e) {
      showToast("Upload gagal", "err");
    } finally { setUploadingResi(false); }
  };

  const requestCair = async (tahap) => {
    setCairingTahap(tahap);
    try {
      const r = await axios.post(`${API}/trips/${trip.trip_id}/cair`, { tahap });
      setTrip(r.data);
      showToast("Tahap " + tahap + " diajukan. Admin akan transfer.");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Belum bisa cair";
      showToast(msg, "err");
    } finally { setCairingTahap(0); }
  };

  const [albumStage, setAlbumStage] = useState("asal");
  const [albumUploading, setAlbumUploading] = useState(false);
  const uploadAlbum = async (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (albumStage !== "dokumen" && isPdf) {
      showToast("PDF cuma boleh di tab Dokumen", "err");
      return;
    }
    if (file.size > 15 * 1024 * 1024) { showToast("File terlalu besar (max 15MB)", "err"); return; }
    setAlbumUploading(true);
    try {
      const fd = new FormData();
      fd.append("stage", albumStage);
      fd.append("foto", file);
      fd.append("uploaded_by", "driver");
      const r = await axios.post(`${API}/trips/${trip.trip_id}/album`, fd);
      setTrip(r.data);
      showToast("Foto " + albumStageLabel(albumStage) + " terupload");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Upload gagal";
      showToast(msg, "err");
    } finally { setAlbumUploading(false); }
  };
  const deleteAlbum = async (stage, photoId) => {
    if (!window.confirm("Hapus foto ini?")) return;
    try {
      const r = await axios.delete(`${API}/trips/${trip.trip_id}/album/${stage}/${photoId}`);
      setTrip(r.data);
      showToast("Foto dihapus");
    } catch {
      showToast("Gagal hapus", "err");
    }
  };

  const resetToday = async () => {
    if (!window.confirm("Reset foto hari ini? (testing only)")) return;
    try {
      const r = await axios.delete(`${API}/trips/${trip.trip_id}/daily/today`);
      setTrip(r.data);
      showToast("Foto hari ini direset");
    } catch {}
  };

  const shareWA = () => {
    const phone = "6281863115";
    const txt = `Halo Admin, lapor posisi unit ${trip?.nopol}.\nNama: ${trip?.nama_driver || "-"}\nRute: ${trip?.route || "-"}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(txt)}`, "_blank");
  };

  if (loading) {
    return <div className="drv-loading">Memuat…</div>;
  }
  if (error) {
    return <div className="drv-error" data-testid="drv-error">{error}</div>;
  }
  if (!trip) {
    return <div className="drv-error">Trip tidak ditemukan.</div>;
  }

  const hh = pad(now.getHours()), mm = pad(now.getMinutes()), ss = pad(now.getSeconds());
  const dayName = ID_DAYS[now.getDay()];

  const initial = trip.initial_photos || {};
  const initialDone = SLOT_ORDER.filter((s) => initial[s]).length;
  const allInitialDone = initialDone === 6;

  const daily = trip.daily_checkpoints || [];
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  })();
  const todayDone = daily.some((c) => c.date === todayStr);
  const dailyCount = daily.length;
  const totalBonusDaily = dailyCount * (trip.bonus_daily || 30000);

  const handover = trip.handover || { bastk: [], resi: null };
  const bastkList = handover.bastk || [];
  const resi = handover.resi;
  const handoverDone = bastkList.length > 0 && !!resi;

  const cair = trip.cair || {};

  return (
    <div className="drv-root" data-testid="drv-root">
      {/* HEADER */}
      <header className="drv-header" data-testid="drv-header">
        <div className="drv-brand">
          <div className="drv-brand-mark">AAL</div>
          <div>
            <div className="drv-brand-name">Alyssa Logistik</div>
            <div className="drv-brand-sub">Driver Checkpoint</div>
          </div>
        </div>
        <div className="drv-clock" data-testid="drv-clock">
          <span className="drv-clock-time">{hh}:{mm}:{ss}</span>
          <span className="drv-clock-date">{dayName}, {todayIso()}</span>
        </div>
      </header>

      {/* TRIP INFO BANNER */}
      <section className="drv-trip-banner" data-testid="trip-banner">
        <div className="drv-nopol-wrap">
          <div className="drv-nopol-lbl">Nomor Polisi</div>
          <div className="drv-nopol" data-testid="drv-nopol">{trip.nopol}</div>
          {trip.tipe_kendaraan && (
            <div className="drv-tipe" data-testid="drv-tipe">{trip.tipe_kendaraan}{trip.no_rangka ? <span className="drv-rangka"> · {trip.no_rangka}</span> : null}</div>
          )}
          {trip.route && <div className="drv-route">📍 {trip.route}</div>}
        </div>
        <div className="drv-greet">
          {trip.nama_driver ? (
            <>
              <div className="drv-greet-lbl">Halo,</div>
              <div className="drv-greet-name" data-testid="drv-greet-name">{trip.nama_driver}</div>
            </>
          ) : (
            <div className="drv-greet-empty">Isi nama dulu yuk</div>
          )}
        </div>
      </section>

      {/* RUTE PENGIRIMAN (LEGS) */}
      {trip.nama_driver && Array.isArray(trip.legs) && trip.legs.length > 0 && (
        <section className="drv-card" data-testid="legs-card">
          <div className="drv-card-head"><span>🛣️ Rute Pengiriman</span></div>
          <div className="drv-card-body drv-legs">
            {trip.legs.map((leg, i) => (
              <div key={i} className="drv-leg-row" data-testid={`leg-${i}`}>
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
            <div className="drv-note">💡 Status leg di-update oleh admin saat unit jalan/tiba. Driver fokus upload foto & dokumen.</div>
          </div>
        </section>
      )}

      {/* INPUT NAMA (kalau belum) */}
      {!trip.nama_driver && (
        <section className="drv-card drv-card-input" data-testid="name-card">
          <div className="drv-card-head">Tulis Nama Anda</div>
          <div className="drv-card-body">
            <input
              type="text"
              placeholder="Contoh: Hermansyah"
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
              className="drv-input"
              data-testid="input-nama"
            />
            <button className="drv-btn drv-btn-gold" onClick={submitNama} disabled={savingName} data-testid="btn-save-nama">
              {savingName ? "Menyimpan..." : "Simpan & Mulai"}
            </button>
          </div>
        </section>
      )}

      {/* BACA SOP */}
      {trip.nama_driver && (
        <section className="drv-card" data-testid="sop-card">
          <div className="drv-card-head">
            <span>📖 Standar Operasi (SOP)</span>
            {trip.sop_read && <span className="drv-pill drv-pill-ok">✓ Sudah Dibaca</span>}
          </div>
          <div className="drv-card-body">
            <button className={`drv-btn ${trip.sop_read ? "drv-btn-ghost" : "drv-btn-gold"}`} onClick={() => setShowSOP(true)} data-testid="btn-baca-sop">
              {trip.sop_read ? "Baca Ulang SOP" : "Baca SOP Dulu"}
            </button>
          </div>
        </section>
      )}

      {/* INITIAL PHOTOS (6 foto wajib) */}
      {trip.nama_driver && (
        <section className="drv-card" data-testid="initial-card">
          <div className="drv-card-head">
            <span>📸 Foto Awal Wajib ({initialDone}/6)</span>
            {allInitialDone && <span className="drv-pill drv-pill-ok">✓ Lengkap</span>}
          </div>
          <div className="drv-card-body">
            <div className="drv-slot-grid">
              {SLOT_ORDER.map((slot) => {
                const photo = initial[slot];
                const isUp = uploadingSlot === slot;
                return (
                  <div key={slot} className={`drv-slot ${photo ? "drv-slot-done" : ""}`} data-testid={`slot-${slot}`}>
                    <input
                      ref={(el) => fileRefs.current[`init-${slot}`] = el}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => uploadInitial(slot, e.target.files?.[0])}
                      style={{ display: "none" }}
                    />
                    {photo ? (
                      <>
                        <img src={`${BACKEND_URL}${photo.url}`} alt={slot} />
                        <div className="drv-slot-check">✓</div>
                      </>
                    ) : (
                      <div className="drv-slot-empty">
                        <div className="drv-slot-icon">📷</div>
                      </div>
                    )}
                    <button
                      className="drv-slot-overlay"
                      onClick={() => triggerFile(`init-${slot}`)}
                      disabled={isUp}
                      data-testid={`btn-slot-${slot}`}
                    >
                      <div className="drv-slot-label">{SLOT_LABELS[slot]}</div>
                      <div className="drv-slot-cta">{isUp ? "Upload..." : (photo ? "Ganti Foto" : "Ambil Foto")}</div>
                    </button>
                  </div>
                );
              })}
            </div>
            {!allInitialDone && (
              <div className="drv-note">💡 Lengkapi 6 foto di atas. Setelah lengkap, Tahap 1 (Rp {(trip.t1||0).toLocaleString("id-ID")}) langsung cair.</div>
            )}
          </div>
        </section>
      )}

      {/* ALBUM PERJALANAN (Asal / Dalam Kapal / Tujuan / Dokumen) */}
      {trip.nama_driver && (
        <section className="drv-card" data-testid="album-card">
          <div className="drv-card-head">
            <span>🗂️ Album Perjalanan</span>
            <span className="drv-pill drv-pill-ready">{(trip.album?.[albumStage] || []).length} foto</span>
          </div>
          <div className="drv-album-tabs" role="tablist">
            {ALBUM_STAGES.map((s) => (
              <button
                key={s}
                role="tab"
                className={`drv-album-tab ${albumStage === s ? "active" : ""}`}
                onClick={() => setAlbumStage(s)}
                data-testid={`album-tab-${s}`}
              >
                <span className="drv-album-tab-ico">{albumStageIcon(s)}</span>
                <span>{albumStageLabel(s)}</span>
                <span className="drv-album-tab-count">{(trip.album?.[s] || []).length}</span>
              </button>
            ))}
          </div>
          <div className="drv-card-body">
            <input
              ref={(el) => fileRefs.current["album"] = el}
              type="file"
              accept={albumStage === "dokumen" ? "image/*,application/pdf" : "image/*"}
              capture={albumStage !== "dokumen" ? "environment" : undefined}
              onChange={(e) => uploadAlbum(e.target.files?.[0])}
              style={{ display: "none" }}
            />
            {(trip.album?.[albumStage] || []).length === 0 ? (
              <div className="drv-album-empty">
                <div style={{ fontSize: 38, opacity: 0.5 }}>{albumStageIcon(albumStage)}</div>
                <div>Belum ada foto {albumStageLabel(albumStage)}.</div>
              </div>
            ) : (
              <div className="drv-album-grid" data-testid={`album-grid-${albumStage}`}>
                {(trip.album[albumStage] || []).map((p) => {
                  const isPdf = (p.url || "").toLowerCase().endsWith(".pdf");
                  return (
                    <div key={p.id} className="drv-album-item" data-testid={`album-item-${p.id}`}>
                      <a href={`${BACKEND_URL}${p.url}`} target="_blank" rel="noreferrer">
                        {isPdf
                          ? <div className="drv-doc-pdf">PDF</div>
                          : <img src={`${BACKEND_URL}${p.url}`} alt={albumStage} />}
                      </a>
                      <button
                        className="drv-album-del"
                        onClick={() => deleteAlbum(albumStage, p.id)}
                        data-testid={`btn-del-${p.id}`}
                        title="Hapus foto"
                      >×</button>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              className="drv-btn drv-btn-blue drv-btn-block"
              onClick={() => triggerFile("album")}
              disabled={albumUploading}
              data-testid={`btn-album-upload-${albumStage}`}
            >
              {albumUploading
                ? "Mengupload..."
                : (albumStage === "dokumen"
                    ? "📎 Tambah Foto / PDF Dokumen"
                    : `📷 Tambah Foto ${albumStageLabel(albumStage)}`)}
            </button>
            <div className="drv-note">
              💡 {albumStage === "dokumen"
                ? "Upload foto/PDF dokumen seperti surat jalan, BAST, copy STNK, dll. Admin & pelanggan akan lihat di sini."
                : "Foto di tahap ini langsung muncul di PO Admin & dilihat pelanggan via link tracking."}
            </div>
          </div>
        </section>
      )}

      {/* DAILY CHECKPOINT */}
      {trip.nama_driver && allInitialDone && (
        <section className="drv-card drv-card-checkpoint" data-testid="daily-card">
          <div className="drv-checkpoint-stats">
            <div className="drv-checkpoint-count" data-testid="daily-count">{dailyCount}</div>
            <div className="drv-checkpoint-lbl">Foto Checkpoint Terkirim</div>
            <div className="drv-checkpoint-bonus">Total bonus foto: <b>{fmtIDR(totalBonusDaily)}</b></div>
          </div>

          <input
            ref={(el) => fileRefs.current["daily"] = el}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => uploadDaily(e.target.files?.[0])}
            style={{ display: "none" }}
          />

          <button
            className={`drv-daily-btn ${todayDone ? "drv-daily-done" : ""}`}
            onClick={() => !todayDone && triggerFile("daily")}
            disabled={uploadingDaily || todayDone}
            data-testid="btn-daily"
          >
            <div className="drv-daily-icon">{todayDone ? "📸" : "📷"}</div>
            <div className="drv-daily-text">
              {uploadingDaily ? "Mengupload..." : (todayDone ? "SUDAH HARI INI ✅" : "BELUM HARI INI")}
            </div>
          </button>

          {todayDone ? (
            <div className="drv-alert drv-alert-ok">
              <b>✓ Foto hari ini sudah terkirim!</b>
              <div>Bonus Rp 30.000 sedang diproses. Foto lagi besok jam 06.00 – 12.00 siang.</div>
            </div>
          ) : (
            <div className="drv-alert drv-alert-info">
              <b>Belum ada foto hari ini.</b>
              <div>Foto depan kendaraan (NoPol kelihatan) untuk klaim bonus Rp 30.000.</div>
            </div>
          )}

          <button className="drv-btn drv-btn-wa" onClick={shareWA} data-testid="btn-wa">📍 Kirim Lokasi ke Admin via WA</button>
          <button className="drv-btn drv-btn-tester" onClick={resetToday} data-testid="btn-reset-today">↺ Reset Foto Hari Ini (tester)</button>

          <div className="drv-bonus-kerajinan">
            <div className="drv-bonus-lbl">BONUS KERAJINAN</div>
            <div className="drv-bonus-amt">+{fmtIDR(trip.bonus_kerajinan || 150000)}</div>
            <div className="drv-bonus-note">Kalau rajin foto tiap hari sampai tiba 💪</div>
          </div>
        </section>
      )}

      {/* PENCAIRAN UANG JALAN */}
      {trip.nama_driver && (
        <section className="drv-card" data-testid="cair-card">
          <div className="drv-card-head"><span>💰 PENCAIRAN UANG JALAN</span></div>
          <div className="drv-card-body drv-cair-list">
            <TahapCard
              num={1}
              color="green"
              title="Tahap 1 — Cair Saat Mulai"
              amount={trip.t1}
              note="Upload 6 foto kendaraan awal — langsung cair"
              cair={!!cair["1"]}
              ready={allInitialDone}
              onCair={() => requestCair(1)}
              loading={cairingTahap === 1}
              testid="tahap-1"
            />
            <TahapCard
              num={2}
              color="blue"
              title="Tahap 2 — Tengah Jalan"
              amount={trip.t2}
              note="Sudah jalan beberapa hari dengan foto rutin"
              cair={!!cair["2"]}
              ready={dailyCount >= 2}
              onCair={() => requestCair(2)}
              loading={cairingTahap === 2}
              testid="tahap-2"
            />
            <TahapCard
              num={3}
              color="gold"
              title="Tahap 3 — Saat Tiba + Bonus"
              amount={trip.t3}
              extra={trip.bonus_kerajinan}
              note="Upload BASTK & Resi dulu untuk cair Tahap 3"
              cair={!!cair["3"]}
              ready={handoverDone}
              onCair={() => requestCair(3)}
              loading={cairingTahap === 3}
              testid="tahap-3"
            />
          </div>
        </section>
      )}

      {/* HANDOVER (BASTK + Resi) */}
      {trip.nama_driver && (
        <section className="drv-card" data-testid="handover-card">
          <div className="drv-card-head">
            <span>📄 Serah Terima Akhir</span>
            {handoverDone && <span className="drv-pill drv-pill-ok">✓ Lengkap</span>}
          </div>
          <div className="drv-card-body">
            <div className="drv-handover-block">
              <div className="drv-handover-title">BASTK (Berita Acara Serah Terima Kendaraan)</div>
              <div className="drv-handover-sub">PDF atau foto. Max 6 lembar. ({bastkList.length}/6)</div>
              <div className="drv-doc-grid">
                {bastkList.map((b) => (
                  <a key={b.id} href={`${BACKEND_URL}${b.url}`} target="_blank" rel="noreferrer" className="drv-doc-thumb">
                    {b.url.toLowerCase().endsWith(".pdf") ? <div className="drv-doc-pdf">PDF</div> : <img src={`${BACKEND_URL}${b.url}`} alt="bastk" />}
                  </a>
                ))}
                {bastkList.length < 6 && (
                  <>
                    <input
                      ref={(el) => fileRefs.current["bastk"] = el}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => uploadBastk(e.target.files?.[0])}
                      style={{ display: "none" }}
                    />
                    <button className="drv-doc-add" onClick={() => triggerFile("bastk")} disabled={uploadingBastk} data-testid="btn-add-bastk">
                      <span>+</span>
                      <span>{uploadingBastk ? "Upload..." : "Tambah BASTK"}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="drv-handover-block">
              <div className="drv-handover-title">Foto Resi Pengiriman Dokumen</div>
              <div className="drv-handover-sub">Resi pengiriman berkas asli yang dikirim ke kantor.</div>
              <input
                ref={(el) => fileRefs.current["resi"] = el}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => uploadResi(e.target.files?.[0])}
                style={{ display: "none" }}
              />
              {resi ? (
                <div className="drv-resi-done">
                  <a href={`${BACKEND_URL}${resi.url}`} target="_blank" rel="noreferrer">
                    {resi.url.toLowerCase().endsWith(".pdf") ? <div className="drv-doc-pdf">PDF</div> : <img src={`${BACKEND_URL}${resi.url}`} alt="resi" />}
                  </a>
                  <button className="drv-btn drv-btn-ghost" onClick={() => triggerFile("resi")} disabled={uploadingResi} data-testid="btn-replace-resi">
                    {uploadingResi ? "Upload..." : "Ganti Foto"}
                  </button>
                </div>
              ) : (
                <button className="drv-btn drv-btn-blue" onClick={() => triggerFile("resi")} disabled={uploadingResi} data-testid="btn-upload-resi">
                  {uploadingResi ? "Upload..." : "📎 Upload Foto Resi"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="drv-footer">
        PT Alyssa Auto Logistik · 0818 631 135<br/>
        <span style={{ opacity: 0.55 }}>v2.2 Driver Checkpoint</span>
      </footer>

      {/* SOP MODAL */}
      {showSOP && (
        <div className="drv-modal-wrap" onClick={() => setShowSOP(false)} data-testid="sop-modal">
          <div className="drv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="drv-modal-head">
              <span>📖 Baca SOP</span>
              <button className="drv-modal-x" onClick={() => setShowSOP(false)}>×</button>
            </div>
            <ol className="drv-sop-list">
              {SOP_TEXT.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <button className="drv-btn drv-btn-gold drv-btn-block" onClick={markSOP} data-testid="btn-sop-ok">
              Saya Mengerti & Setuju
            </button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`drv-toast ${toast.type === "err" ? "drv-toast-err" : "drv-toast-ok"}`} data-testid="toast">
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function TahapCard({ num, color, title, amount, extra, note, cair, ready, onCair, loading, testid }) {
  const colorCls = `drv-tahap-${color}`;
  return (
    <div className={`drv-tahap ${colorCls} ${cair ? "drv-tahap-cair" : ""}`} data-testid={testid}>
      <div className="drv-tahap-head">
        <div className="drv-tahap-title">{title}</div>
        <span className={`drv-pill ${cair ? "drv-pill-ok" : (ready ? "drv-pill-ready" : "drv-pill-wait")}`}>
          {cair ? "Cair" : (ready ? "Siap" : "Belum")}
        </span>
      </div>
      <div className="drv-tahap-amt">
        {fmtIDR(amount)}
        {extra > 0 && <span className="drv-tahap-extra"> (+{fmtIDR(extra)} bonus)</span>}
      </div>
      <div className="drv-tahap-note">{note}</div>
      {cair ? (
        <div className="drv-tahap-status drv-tahap-status-cair">✓ Sudah Cair {fmtIDR(amount + (extra||0))}</div>
      ) : (
        <button
          className={`drv-btn drv-btn-block drv-btn-${color}`}
          onClick={onCair}
          disabled={!ready || loading}
          data-testid={`btn-${testid}`}
        >
          {loading ? "Memproses..." : (ready ? `Cairkan Tahap ${num}` : "Belum bisa cair")}
        </button>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import "@/App.css";
import "@/Driver.css";
import PoDCard from "@/PoDCard";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/* Resolve foto URL — Supabase URLs sudah absolute, lainnya prepend BACKEND_URL */
function resolveUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${BACKEND_URL}${url}`;
}

/* Best-effort nama lokasi dari koordinat (OpenStreetMap). Gagal/timeout → "". */
async function reverseGeocode(lat, lng) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&addressdetails=1&lat=${lat}&lon=${lng}`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } }
    );
    clearTimeout(t);
    if (!r.ok) return "";
    const j = await r.json();
    const a = j.address || {};
    const parts = [
      a.suburb || a.village || a.town || a.city_district || a.neighbourhood,
      a.city || a.county || a.regency,
      a.state,
    ].filter(Boolean);
    return parts.slice(0, 2).join(", ") || (j.display_name || "").split(",").slice(0, 2).join(", ").trim();
  } catch {
    return "";
  }
}

/* "Cap" foto: bakar lokasi + waktu ke dalam gambar (mirip GPS Map Camera).
   `lines` ditulis di bar bawah. Gagal apa pun → kembalikan file asli. */
function stampPhoto(file, lines) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
      img.onload = () => {
        try {
          const maxW = 1280;
          const scale = img.width > maxW ? maxW / img.width : 1;
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);

          const rows = (lines || []).filter(Boolean);
          if (rows.length) {
            const fs = Math.max(15, Math.round(w * 0.030));
            const lh = Math.round(fs * 1.4);
            const pad = Math.round(w * 0.022);
            const barH = lh * rows.length + pad * 1.6;
            ctx.fillStyle = "rgba(8,18,36,0.62)";
            ctx.fillRect(0, h - barH, w, barH);
            ctx.fillStyle = "#D4A847";
            ctx.fillRect(0, h - barH, Math.max(4, Math.round(w * 0.012)), barH);
            ctx.textBaseline = "top";
            let y = h - barH + pad * 0.8;
            rows.forEach((ln, i) => {
              ctx.font = `500 ${fs}px sans-serif`;
              ctx.fillStyle = i === 0 ? "#FFD77A" : "#FFFFFF";
              ctx.fillText(ln, pad * 1.6, y);
              y += lh;
            });
          }
          URL.revokeObjectURL(objUrl);
          canvas.toBlob(
            (blob) => resolve(blob
              ? new File([blob], (file.name || "checkpoint").replace(/\.\w+$/, "") + "_geotag.jpg", { type: "image/jpeg" })
              : file),
            "image/jpeg", 0.9
          );
        } catch { URL.revokeObjectURL(objUrl); resolve(file); }
      };
      img.src = objUrl;
    } catch { resolve(file); }
  });
}

const ID_MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const ID_DAYS = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

const SLOT_LABELS = {
  depan: "Tampak Depan",
  belakang: "Tampak Belakang",
  kiri: "Sisi Kiri",
  kanan: "Sisi Kanan",
  spidometer: "Dashboard / Spidometer",
};
const SLOT_ORDER = ["depan", "belakang", "kiri", "kanan", "spidometer"];

const SOP_POINTS = [
  { title: "CEK FISIK", body: "Cek oli, air radiator, lampu, dan ban (termasuk ban serep) sebelum berangkat." },
  { title: "FOTO UNIT", body: "Wajib upload foto 4 sisi mobil + foto dashboard bensin sebelum gas." },
  { title: "UPDATE FOTO JALUR", body: "Klik tombol hijau setiap hari antara jam 06.00 – 12.00 siang. Foto lokasi wajib terkirim dalam window waktu tersebut. Dapat Rp 30.000 per foto!" },
  { title: "ATURAN KABIN", body: "Dilarang merokok di dalam mobil. Dilarang beri tumpangan orang asing. Kecepatan tol max 80–100 km/jam." },
  { title: "PENAMPILAN", body: "Wajib berpakaian rapi dan sopan saat bertemu pelanggan di tujuan." },
  { title: "ATURAN FINISH", body: "Mobil WAJIB DICUCI BERSIH dan bensin/solar minimal sisa 1 BAR sebelum serah terima ke konsumen." },
  { title: "DOKUMEN AMAN", body: "Foto BASTK yang ditandatangani konsumen + foto resi ekspedisi asli agar sisa uang jalan langsung cair via Xendit." },
];

function pad(n) { return String(n).padStart(2, "0"); }
function fmtIDR(n) { return "Rp " + (Number(n)||0).toLocaleString("id-ID"); }
function albumStageLabel(s) {
  return { asal: "Asal", kapal: "Dalam Kapal", tujuan: "Tujuan", dokumen: "Dokumen" }[s] || s;
}
function albumStageIcon(_s) { return null; }
const ALBUM_STAGES = ["asal", "kapal", "tujuan", "dokumen"];

function Logo({ size = 96 }) {
  return <img src="/logo.png" alt="PT Alyssa Auto Logistik" width={size} height={size} style={{ objectFit: "contain" }} />;
}
function todayIso() {
  // Tampilan tanggal lokal browser (WIB di mobile user)
  const d = new Date();
  return `${pad(d.getDate())} ${ID_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function readURLParams() {
  const u = new URL(window.location.href);
  const q = u.searchParams;
  // New: /trip/{trip_id} — extra params still come from query string
  const pathSeg = u.pathname.match(/^\/trip\/(.+)/);
  const tripFromPath = pathSeg ? decodeURIComponent(pathSeg[1]) : "";
  let legs = [];
  try {
    const raw = q.get("legs");
    if (raw) legs = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(legs)) legs = [];
  } catch { legs = []; }
  return {
    trip:   tripFromPath || q.get("trip") || "",
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

// A "real" plate is a non-empty nopol that isn't the TBD placeholder for new cars.
const isRealPlate = (np) => !!np && !/^TBD-/i.test(np);

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
  const [dailyStatus, setDailyStatus] = useState("Berangkat");
  const [dailyNote, setDailyNote] = useState("");
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
    if (!params.trip || (!params.nopol && !params.rangka)) {
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
    // Best-effort GPS capture (5s timeout). Kalau gagal/denied, lanjut tanpa GPS.
    const getGPS = () => new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    });
    try {
      const gps = await getGPS();
      // Cap lokasi + waktu ke dalam foto (geotag tertanam di gambar).
      const nowWib = new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      const stampLines = [];
      if (gps) {
        const place = await reverseGeocode(gps.lat, gps.lng);
        if (place) stampLines.push(place);
        stampLines.push(`${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`);
      }
      stampLines.push(`${nowWib} WIB${trip?.nopol ? "  ·  " + trip.nopol : ""}`);
      const stamped = await stampPhoto(file, stampLines);

      const fd = new FormData();
      fd.append("foto", stamped);
      if (gps) {
        fd.append("lat", String(gps.lat));
        fd.append("lng", String(gps.lng));
      }
      if (dailyStatus) fd.append("status", dailyStatus);
      if (dailyNote.trim()) fd.append("keterangan", dailyNote.trim());
      const r = await axios.post(`${API}/trips/${trip.trip_id}/photos/daily`, fd);
      setTrip(r.data);
      showToast(gps
        ? "Checkpoint + lokasi terkirim! Bonus Rp 30.000 diproses."
        : "Checkpoint terkirim (tanpa GPS). Bonus Rp 30.000 diproses.");
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
    return (
      <div className="drv-root">
        <header className="drv-header">
          <div className="drv-brand">
            <Logo size={36} />
            <div>
              <div className="drv-brand-name">Driver Checkpoint</div>
              <div className="drv-brand-sub">Alyssa Auto Logistik</div>
            </div>
          </div>
        </header>
        <div style={{ textAlign:"center", padding:"48px 24px" }} data-testid="drv-error">
          <div style={{ marginBottom:16 }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none"><circle cx="28" cy="28" r="26" stroke="#D4A847" strokeWidth="2"/><path d="M28 17v14M28 37h.01" stroke="#D4A847" strokeWidth="2.5" strokeLinecap="round"/></svg>
          </div>
          <h2 style={{ color:"#D4A847", marginBottom:8 }}>Link Tidak Valid</h2>
          <p style={{ color:"#8aa3c4", marginBottom:4 }}>{error}</p>
          <p style={{ color:"#8aa3c4", marginBottom:24 }}>Minta link yang benar dari admin PT Alyssa Auto Logistik.</p>
          <a href="/" style={{ color:"#D4A847", textDecoration:"none", marginRight:16 }}>← Beranda</a>
          <a href="https://wa.me/628186311350" target="_blank" rel="noreferrer"
             style={{ background:"#16a34a", color:"#fff", padding:"8px 16px", borderRadius:8, textDecoration:"none", fontSize:14 }}>
            Hubungi via WhatsApp
          </a>
        </div>
      </div>
    );
  }
  if (!trip) {
    return <div className="drv-error">Trip tidak ditemukan.</div>;
  }

  // ===== STEP 1: NAMA (full-screen, premium) =====
  if (!trip.nama_driver) {
    return (
      <div className="drv-root drv-step-screen" data-testid="drv-name-screen">
        <div className="drv-step-card" data-testid="name-card">
          <Logo size={100} />
          <div className="drv-step-brand">ALYSSA LOGISTIK</div>
          <div className="drv-step-form">
            <div className="drv-step-greet">Halo Driver!</div>
            <div className="drv-step-greet-sub">Masukkan nama lengkap sesuai KTP</div>
            <label className="drv-step-label" htmlFor="drv-nama-input">NAMA LENGKAP</label>
            <input
              id="drv-nama-input"
              type="text"
              placeholder="Nama sesuai KTP"
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitNama(); }}
              className="drv-step-input"
              autoComplete="name"
              autoFocus
              data-testid="input-nama"
            />
            <button
              className="drv-step-cta"
              onClick={submitNama}
              disabled={savingName}
              data-testid="btn-save-nama"
            >
              {savingName ? "Menyimpan..." : "Lanjut →"}
            </button>
            <div className="drv-step-footnote">Data rekening akan diisi oleh admin</div>
          </div>
          {(isRealPlate(trip.nopol) || trip.no_rangka) && (
            <div className="drv-step-trip-pill" data-testid="drv-step-nopol">
              <span>UNIT</span><b>{isRealPlate(trip.nopol) ? trip.nopol : `Rangka ${trip.no_rangka}`}</b>
            </div>
          )}
        </div>
        {toast && (
          <div className={`drv-toast ${toast.type === "err" ? "drv-toast-err" : "drv-toast-ok"}`} data-testid="toast">
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ===== STEP 2: SOP (full-screen, forced) =====
  if (!trip.sop_read) {
    return (
      <div className="drv-root drv-step-screen drv-step-sop" data-testid="drv-sop-screen">
        <div className="drv-sop-banner">
          <div className="drv-sop-warn">!</div>
          <div className="drv-sop-banner-title">WAJIB BACA SEBELUM JALAN!</div>
          <div className="drv-sop-banner-sub">7 PERINTAH DRIVER ALYSSA</div>
        </div>
        <ol className="drv-sop-points">
          {SOP_POINTS.map((p, i) => (
            <li key={i} className="drv-sop-point">
              <div className="drv-sop-num">{i + 1}</div>
              <div className="drv-sop-body"><b>{p.title}:</b> {p.body}</div>
            </li>
          ))}
        </ol>
        <div className="drv-sop-emergency">
          <div className="drv-sop-emergency-icon">!</div>
          <div className="drv-sop-emergency-text">
            <b>DARURAT:</b> Jika mobil mogok atau ada kendala berat, <b>DILARANG</b> bongkar/perbaiki sendiri tanpa izin kantor! Hubungi admin: <b>0818 631 135</b>
          </div>
        </div>
        <button className="drv-sop-accept" onClick={markSOP} data-testid="btn-sop-ok">
          <span className="drv-sop-accept-emoji">✓</span>
          <div className="drv-sop-accept-text">
            <div className="drv-sop-accept-main">Saya Sudah Baca &amp; Setuju</div>
            <div className="drv-sop-accept-sub">Tap tombol ini untuk lanjut</div>
          </div>
        </button>
        {toast && (
          <div className={`drv-toast ${toast.type === "err" ? "drv-toast-err" : "drv-toast-ok"}`} data-testid="toast">
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  const hh = pad(now.getHours()), mm = pad(now.getMinutes()), ss = pad(now.getSeconds());
  const dayName = ID_DAYS[now.getDay()];

  const initial = trip.initial_photos || {};
  const initialDone = SLOT_ORDER.filter((s) => initial[s]).length;
  const allInitialDone = initialDone === 5;

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
          <Logo size={36} />
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
          <div className="drv-nopol-lbl">{isRealPlate(trip.nopol) ? "Nomor Polisi" : "No. Rangka"}</div>
          <div className="drv-nopol" data-testid="drv-nopol">
            {isRealPlate(trip.nopol) ? trip.nopol : (trip.no_rangka || trip.nopol || "—")}
          </div>
          {trip.tipe_kendaraan && (
            <div className="drv-tipe" data-testid="drv-tipe">
              {trip.tipe_kendaraan}
              {isRealPlate(trip.nopol) && trip.no_rangka ? <span className="drv-rangka"> · Rangka {trip.no_rangka}</span> : null}
            </div>
          )}
          {trip.route && <div className="drv-route">{trip.route}</div>}
        </div>
        <div className="drv-greet">
          <div className="drv-greet-lbl">Halo,</div>
          <div className="drv-greet-name" data-testid="drv-greet-name">{trip.nama_driver}</div>
        </div>
      </section>

      {/* RUTE PENGIRIMAN (LEGS) */}
      {trip.nama_driver && Array.isArray(trip.legs) && trip.legs.length > 0 && (
        <section className="drv-card" data-testid="legs-card">
          <div className="drv-card-head"><span>Rute Pengiriman</span></div>
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
            <div className="drv-note">Status leg di-update oleh admin saat unit jalan/tiba. Driver fokus upload foto &amp; dokumen.</div>
          </div>
        </section>
      )}

      {/* BACA ULANG SOP (kecil, opsional) */}
      <section className="drv-card" data-testid="sop-card">
        <div className="drv-card-head">
          <span>SOP Driver</span>
          <span className="drv-pill drv-pill-ok">Sudah Dibaca</span>
        </div>
        <div className="drv-card-body">
          <button className="drv-btn drv-btn-ghost" onClick={() => setShowSOP(true)} data-testid="btn-baca-sop">
            Baca Ulang SOP
          </button>
        </div>
      </section>

      {/* INITIAL PHOTOS (5 foto wajib) */}
      {trip.nama_driver && (
        <section className="drv-card" data-testid="initial-card">
          <div className="drv-card-head">
            <span>Foto Awal Wajib ({initialDone}/5)</span>
            {allInitialDone && <span className="drv-pill drv-pill-ok">Lengkap</span>}
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
                        <img src={resolveUrl(photo.url)} alt={slot} />
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
              <div className="drv-note">Lengkapi 5 foto di atas. Setelah lengkap, Tahap 1 (Rp {(trip.t1||0).toLocaleString("id-ID")}) langsung cair.</div>
            )}
          </div>
        </section>
      )}

      {/* ALBUM PERJALANAN (Asal / Dalam Kapal / Tujuan / Dokumen) */}
      {trip.nama_driver && (
        <section className="drv-card" data-testid="album-card">
          <div className="drv-card-head">
            <span>Album Perjalanan</span>
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
                <div>Belum ada foto {albumStageLabel(albumStage)}.</div>
              </div>
            ) : (
              <div className="drv-album-grid" data-testid={`album-grid-${albumStage}`}>
                {(trip.album[albumStage] || []).map((p) => {
                  const isPdf = (p.url || "").toLowerCase().endsWith(".pdf");
                  return (
                    <div key={p.id} className="drv-album-item" data-testid={`album-item-${p.id}`}>
                      <a href={resolveUrl(p.url)} target="_blank" rel="noreferrer">
                        {isPdf
                          ? <div className="drv-doc-pdf">PDF</div>
                          : <img src={resolveUrl(p.url)} alt={albumStage} />}
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
                    ? "Tambah Foto / PDF Dokumen"
                    : `Tambah Foto ${albumStageLabel(albumStage)}`)}
            </button>
            <div className="drv-note">
              {albumStage === "dokumen"
                ? "Upload foto/PDF dokumen seperti surat jalan, BAST, copy STNK, dll. Admin & pelanggan akan lihat di sini."
                : "Foto di tahap ini langsung muncul di PO Admin & dilihat pelanggan via link tracking."}
            </div>
          </div>
        </section>
      )}

      {/* REMINDER 06:00 WIB — kalau hari ini belum upload */}
      {trip.nama_driver && allInitialDone && !todayDone && (() => {
        const wibNow = new Date(Date.now() + (new Date().getTimezoneOffset() + 7 * 60) * 60000);
        const wibHour = wibNow.getHours();
        const isWindow = wibHour >= 6 && wibHour < 12;
        const isLate = wibHour >= 12;
        return (
          <section className={`drv-reminder ${isLate ? "drv-reminder-late" : (isWindow ? "drv-reminder-now" : "drv-reminder-soon")}`} data-testid="daily-reminder">
            <div className="drv-reminder-icon">{isLate ? "!" : (isWindow ? "CAM" : "~")}</div>
            <div className="drv-reminder-text">
              <b>
                {isLate ? "TERLAMBAT! Foto deadline lewat" : (isWindow ? "WAKTUNYA FOTO CHECKPOINT" : "Reminder Besok Pagi")}
              </b>
              <div>
                {isLate
                  ? "Window 06:00–12:00 WIB sudah lewat. Tetap foto sekarang untuk catat lokasi, tapi bonus harian besok ya."
                  : (isWindow
                      ? `Window aktif sampai 12:00 WIB. Sisa ${11 - wibHour} jam lagi. Tap kamera di bawah!`
                      : "Jangan lupa foto checkpoint besok jam 06:00–12:00 WIB untuk dapat bonus Rp 30.000.")}
              </div>
            </div>
          </section>
        );
      })()}

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

          {/* Status + keterangan inputs (sebelum tap tombol kamera) */}
          {!todayDone && (
            <div className="drv-daily-form" data-testid="daily-status-form">
              <label className="drv-step-label">STATUS PERJALANAN</label>
              <select
                className="drv-step-input"
                value={dailyStatus}
                onChange={(e) => setDailyStatus(e.target.value)}
                data-testid="select-daily-status"
              >
                <option value="Berangkat">Berangkat</option>
                <option value="Checkpoint 1">Checkpoint 1</option>
                <option value="Checkpoint 2">Checkpoint 2</option>
                <option value="Checkpoint 3">Checkpoint 3</option>
                <option value="Tiba Tujuan">Tiba Tujuan</option>
              </select>
              <label className="drv-step-label" style={{ marginTop: 8 }}>KETERANGAN (OPSIONAL)</label>
              <input
                type="text"
                className="drv-step-input"
                placeholder="Cth: Sudah lewat Cikampek, lalin lancar"
                value={dailyNote}
                onChange={(e) => setDailyNote(e.target.value)}
                maxLength={200}
                data-testid="input-daily-note"
              />
            </div>
          )}

          <button
            className={`drv-daily-btn ${todayDone ? "drv-daily-done" : ""}`}
            onClick={() => !todayDone && triggerFile("daily")}
            disabled={uploadingDaily || todayDone}
            data-testid="btn-daily"
          >
            <div className="drv-daily-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden><path d="M4 10.5c0-1.1.9-2 2-2h1.5l1.5-2.5h10L20.5 8.5H22c1.1 0 2 .9 2 2V21c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V10.5z" stroke="currentColor" strokeWidth="1.8"/><circle cx="14" cy="15" r="3.5" stroke="currentColor" strokeWidth="1.8"/></svg>
            </div>
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

          <button className="drv-btn drv-btn-wa" onClick={shareWA} data-testid="btn-wa">Kirim Lokasi ke Admin via WA</button>
          <button className="drv-btn drv-btn-tester" onClick={resetToday} data-testid="btn-reset-today">↺ Reset Foto Hari Ini (tester)</button>

          <div className="drv-bonus-kerajinan">
            <div className="drv-bonus-lbl">BONUS KERAJINAN</div>
            <div className="drv-bonus-amt">+{fmtIDR(trip.bonus_kerajinan || 150000)}</div>
            <div className="drv-bonus-note">Kalau rajin foto tiap hari sampai tiba</div>
          </div>
        </section>
      )}

      {/* PROOF OF DELIVERY (Daily checkpoint list with map+info) */}
      {trip.nama_driver && daily.length > 0 && (
        <section className="drv-card" data-testid="pod-card-list">
          <div className="drv-card-head">
            <span>Proof of Delivery</span>
            <span className="drv-pill drv-pill-ok">{daily.length} checkpoint</span>
          </div>
          <div className="drv-card-body drv-pod-list">
            {[...daily].slice().reverse().map((cp, i) => (
              <PoDCard
                key={cp.id}
                photo={cp}
                backendUrl={BACKEND_URL}
                namaDriver={trip.nama_driver}
                nopol={trip.nopol}
                dayIndex={daily.length - 1 - i}
              />
            ))}
          </div>
        </section>
      )}

      {/* PENCAIRAN UANG JALAN */}
      {trip.nama_driver && (
        <section className="drv-card" data-testid="cair-card">
          <div className="drv-card-head"><span>Pencairan Uang Jalan</span></div>
          <div className="drv-card-body drv-cair-list">
            <TahapCard
              num={1}
              color="green"
              title="Tahap 1 — Cair Saat Mulai"
              amount={trip.t1}
              note="Upload 5 foto kendaraan awal — langsung cair"
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
            <span>Serah Terima Akhir</span>
            {handoverDone && <span className="drv-pill drv-pill-ok">Lengkap</span>}
          </div>
          <div className="drv-card-body">
            <div className="drv-handover-block">
              <div className="drv-handover-title">BASTK (Berita Acara Serah Terima Kendaraan)</div>
              <div className="drv-handover-sub">PDF atau foto. Max 6 lembar. ({bastkList.length}/6)</div>
              <div className="drv-doc-grid">
                {bastkList.map((b) => (
                  <a key={b.id} href={resolveUrl(b.url)} target="_blank" rel="noreferrer" className="drv-doc-thumb">
                    {b.url.toLowerCase().endsWith(".pdf") ? <div className="drv-doc-pdf">PDF</div> : <img src={resolveUrl(b.url)} alt="bastk" />}
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
                  <a href={resolveUrl(resi.url)} target="_blank" rel="noreferrer">
                    {resi.url.toLowerCase().endsWith(".pdf") ? <div className="drv-doc-pdf">PDF</div> : <img src={resolveUrl(resi.url)} alt="resi" />}
                  </a>
                  <button className="drv-btn drv-btn-ghost" onClick={() => triggerFile("resi")} disabled={uploadingResi} data-testid="btn-replace-resi">
                    {uploadingResi ? "Upload..." : "Ganti Foto"}
                  </button>
                </div>
              ) : (
                <button className="drv-btn drv-btn-blue" onClick={() => triggerFile("resi")} disabled={uploadingResi} data-testid="btn-upload-resi">
                  {uploadingResi ? "Upload..." : "Upload Foto Resi"}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="drv-footer">
        PT Alyssa Auto Logistik · 0818 631 135<br/>
        <span style={{ opacity: 0.55 }}>v2.4 Driver Checkpoint</span>
      </footer>

      {/* SOP MODAL — Premium full-screen design */}
      {showSOP && (
        <div className="drv-sop-overlay" data-testid="sop-modal">
          <div className="drv-sop-screen">
            <div className="drv-sop-banner">
              <div className="drv-sop-warn">!</div>
              <div className="drv-sop-banner-title">WAJIB BACA SEBELUM JALAN!</div>
              <div className="drv-sop-banner-sub">7 PERINTAH DRIVER ALYSSA</div>
            </div>
            <ol className="drv-sop-points">
              {SOP_POINTS.map((p, i) => (
                <li key={i} className="drv-sop-point">
                  <div className="drv-sop-num">{i + 1}</div>
                  <div className="drv-sop-body">
                    <b>{p.title}:</b> {p.body}
                  </div>
                </li>
              ))}
            </ol>
            <div className="drv-sop-emergency">
              <div className="drv-sop-emergency-icon">!</div>
              <div className="drv-sop-emergency-text">
                <b>DARURAT:</b> Jika mobil mogok atau ada kendala berat, <b>DILARANG</b> bongkar/perbaiki sendiri tanpa izin kantor! Hubungi admin: <b>0818 631 135</b>
              </div>
            </div>
            <button className="drv-sop-accept" onClick={markSOP} data-testid="btn-sop-ok">
              <span className="drv-sop-accept-emoji">✓</span>
              <div className="drv-sop-accept-text">
                <div className="drv-sop-accept-main">Saya Sudah Baca &amp; Setuju</div>
                <div className="drv-sop-accept-sub">Tap tombol ini untuk lanjut</div>
              </div>
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

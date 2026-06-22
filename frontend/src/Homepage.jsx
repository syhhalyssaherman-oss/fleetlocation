import { useState } from "react";
import "@/Homepage.css";

/* ── Dark mode toggle ── */
function useDarkMode() {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark"
  );
  function toggle() {
    const next = !dark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("aal-theme", next ? "dark" : "light"); } catch (_) {}
    setDark(next);
  }
  return [dark, toggle];
}

/* ── Logo mark ── */
function AALMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="mkGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4A847" />
          <stop offset="100%" stopColor="#8A5E10" />
        </linearGradient>
        <radialGradient id="mkGreen" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#3CB371" />
          <stop offset="100%" stopColor="#0F5132" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="92" rx="40" ry="10" fill="url(#mkGreen)" />
      <path d="M22,88 Q60,72 98,88 L98,96 Q60,82 22,96 Z" fill="url(#mkGreen)" opacity="0.85" />
      <rect x="58.5" y="30" width="3" height="58" fill="url(#mkGold)" />
      <path d="M61.5,28 L92,38 L61.5,52 Z" fill="#E11D48" stroke="#7F1D1D" strokeWidth="1" />
      <ellipse cx="60" cy="90" rx="6" ry="2" fill="rgba(0,0,0,0.25)" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
function IconDoc() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  );
}
function IconWA() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

/* ══════════════════════════════════════════ */
export default function Homepage() {
  const [trackInput, setTrackInput] = useState("");
  const [trackError, setTrackError] = useState("");
  const [dark, toggleDark] = useDarkMode();

  function handleTrack(e) {
    e.preventDefault();
    const id = trackInput.trim();
    if (!id) { setTrackError("Masukkan Trip ID terlebih dahulu."); return; }
    setTrackError("");
    window.location.href = `/track/${encodeURIComponent(id)}`;
  }

  return (
    <div className="hp-root">

      {/* ── HEADER ── */}
      <header className="hp-header">
        <div className="hp-header-inner">
          <a href="/" className="hp-brand-link">
            <AALMark size={34} />
            <div className="hp-brand">
              <span className="hp-brand-name">PT Alyssa Auto Logistik</span>
              <span className="hp-brand-tag">Pengiriman Kendaraan</span>
            </div>
          </a>
          <nav className="hp-nav">
            <a className="hp-nav-link" href="/order">Pesan</a>
            <a className="hp-nav-link" href="/guide">Panduan</a>
            <a className="hp-nav-link" href="/admin">Admin</a>
            <a className="hp-nav-wa" href="https://wa.me/628186311350" target="_blank" rel="noreferrer">
              <IconWA /> WhatsApp
            </a>
            <button className="hp-theme-btn" onClick={toggleDark} aria-label="Toggle dark mode" title={dark ? "Mode terang" : "Mode gelap"}>
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
          </nav>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="hp-hero">
        <div className="hp-hero-content">
          <div className="hp-eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            Layanan Pengiriman Kendaraan
          </div>
          <h1 className="hp-title">
            Kirim Kendaraan Anda<br />
            <em className="hp-title-em">Aman &amp; Terpantau</em>
          </h1>
          <p className="hp-sub">
            Kami mengantarkan kendaraan Anda ke seluruh Indonesia dengan sistem pelacakan
            real-time, dokumentasi BASTK digital, dan laporan foto di setiap checkpoint.
          </p>
          <div className="hp-hero-actions">
            <a className="hp-btn hp-btn-primary" href="/order">Buat Pesanan Sekarang</a>
            <a className="hp-btn hp-btn-ghost" href="https://wa.me/628186311350" target="_blank" rel="noreferrer">
              <IconWA /> Konsultasi Gratis
            </a>
          </div>
          <div className="hp-trust-row">
            <span className="hp-trust-item"><IconCheck />Asuransi perjalanan</span>
            <span className="hp-trust-item"><IconCheck />Dokumen BASTK digital</span>
            <span className="hp-trust-item"><IconCheck />Update foto real-time</span>
          </div>
        </div>
        <div className="hp-hero-gradient" aria-hidden="true" />
      </section>

      {/* ── STATS ── */}
      <div className="hp-stats-strip">
        <div className="hp-stats-inner">
          <div className="hp-stat"><span className="hp-stat-n">100+</span><span className="hp-stat-l">Pengiriman Selesai</span></div>
          <div className="hp-stat-div" />
          <div className="hp-stat"><span className="hp-stat-n">3+</span><span className="hp-stat-l">Tahun Berpengalaman</span></div>
          <div className="hp-stat-div" />
          <div className="hp-stat"><span className="hp-stat-n">Nasional</span><span className="hp-stat-l">Seluruh Indonesia</span></div>
          <div className="hp-stat-div" />
          <div className="hp-stat"><span className="hp-stat-n">24/7</span><span className="hp-stat-l">Dukungan WhatsApp</span></div>
        </div>
      </div>

      {/* ── TRACK BAND ── */}
      <section className="hp-track-band">
        <div className="hp-track-inner">
          <div className="hp-track-copy">
            <h2 className="hp-track-title">Lacak Pengiriman Anda</h2>
            <p className="hp-track-sub">Masukkan Trip ID dari admin untuk melihat posisi dan status kendaraan secara real-time.</p>
          </div>
          <form className="hp-track-form" onSubmit={handleTrack}>
            <div className="hp-track-field">
              <svg className="hp-track-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                className="hp-track-input"
                type="text"
                placeholder="Contoh: TRIP-AF291C"
                value={trackInput}
                onChange={e => { setTrackInput(e.target.value); setTrackError(""); }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>
            <button className="hp-btn hp-btn-primary" type="submit">Lacak Sekarang</button>
          </form>
          {trackError && <p className="hp-track-error">{trackError}</p>}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="hp-section">
        <div className="hp-section-hd">
          <div className="hp-eyebrow">Cara Kerja</div>
          <h2 className="hp-section-title">Proses Pengiriman <br className="hp-br-hide"/>Mudah &amp; Transparan</h2>
          <p className="hp-section-sub">Dari pemesanan hingga kendaraan tiba, semua terdokumentasi.</p>
        </div>
        <div className="hp-steps">
          <div className="hp-step">
            <div className="hp-step-n">01</div>
            <h3 className="hp-step-title">Isi Formulir Pesanan</h3>
            <p className="hp-step-desc">Lengkapi data kendaraan, asal, tujuan, dan kontak penerima. Hanya butuh 3 menit.</p>
          </div>
          <div className="hp-step-arrow" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>
          </div>
          <div className="hp-step">
            <div className="hp-step-n">02</div>
            <h3 className="hp-step-title">Konfirmasi &amp; Keberangkatan</h3>
            <p className="hp-step-desc">Admin menghubungi Anda untuk konfirmasi jadwal dan estimasi biaya, lalu driver berangkat.</p>
          </div>
          <div className="hp-step-arrow" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>
          </div>
          <div className="hp-step">
            <div className="hp-step-n">03</div>
            <h3 className="hp-step-title">Pantau &amp; Terima Kendaraan</h3>
            <p className="hp-step-desc">Lacak via Trip ID, terima foto checkpoint, dan BASTK digital saat kendaraan tiba.</p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="hp-features-section">
        <div className="hp-features-hd">
          <div className="hp-eyebrow">Keunggulan</div>
          <h2 className="hp-section-title">Kenapa Pilih Kami?</h2>
          <p className="hp-section-sub">Sistem kami dirancang untuk transparansi penuh dan ketenangan pikiran pelanggan.</p>
        </div>
        <div className="hp-features-grid">
          <div className="hp-feat">
            <div className="hp-feat-icon"><IconPin /></div>
            <h3 className="hp-feat-title">Pelacakan Real-Time</h3>
            <p className="hp-feat-desc">Pantau posisi kendaraan kapan saja lewat Trip ID yang dikirim admin via WhatsApp.</p>
          </div>
          <div className="hp-feat">
            <div className="hp-feat-icon"><IconDoc /></div>
            <h3 className="hp-feat-title">Dokumen Digital</h3>
            <p className="hp-feat-desc">BASTK digital diterbitkan otomatis setelah tiba. Foto checkpoint tersimpan di cloud.</p>
          </div>
          <div className="hp-feat">
            <div className="hp-feat-icon"><IconCard /></div>
            <h3 className="hp-feat-title">Pembayaran Transparan</h3>
            <p className="hp-feat-desc">Biaya terdokumentasi setiap tahap. Tidak ada biaya tersembunyi.</p>
          </div>
          <div className="hp-feat">
            <div className="hp-feat-icon"><IconShield /></div>
            <h3 className="hp-feat-title">Penanganan Aman</h3>
            <p className="hp-feat-desc">Prosedur baku setiap pengiriman dengan dokumentasi kondisi kendaraan awal &amp; akhir.</p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="hp-cta-section">
        <div className="hp-cta-inner">
          <h2 className="hp-cta-title">Siap Kirimkan Kendaraan Anda?</h2>
          <p className="hp-cta-sub">Hubungi kami untuk estimasi biaya gratis, atau langsung buat pesanan sekarang.</p>
          <div className="hp-cta-btns">
            <a className="hp-btn hp-btn-white" href="/order">Buat Pesanan</a>
            <a className="hp-btn hp-btn-wa-light" href="https://wa.me/628186311350" target="_blank" rel="noreferrer">
              <IconWA /> 0818-631-135
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-left">
            <div className="hp-footer-brand">
              <AALMark size={26} />
              <span className="hp-footer-name">PT Alyssa Auto Logistik</span>
            </div>
            <p className="hp-footer-copy">© {new Date().getFullYear()} Seluruh hak dilindungi.</p>
          </div>
          <nav className="hp-footer-links">
            <a href="/order">Buat Pesanan</a>
            <a href="/guide">Panduan Driver</a>
            <a href="/admin">Admin Dashboard</a>
            <a href="https://wa.me/628186311350" target="_blank" rel="noreferrer">WhatsApp</a>
          </nav>
        </div>
      </footer>

    </div>
  );
}

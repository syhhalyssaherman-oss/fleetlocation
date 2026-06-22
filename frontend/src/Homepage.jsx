import { useState } from "react";
import "@/Homepage.css";

function AALLogo({ size = 80 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-label="PT Alyssa Auto Logistik">
      <defs>
        <linearGradient id="hpGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4A847" />
          <stop offset="100%" stopColor="#854F0B" />
        </linearGradient>
        <radialGradient id="hpGreen" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#3CB371" />
          <stop offset="100%" stopColor="#0F5132" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="92" rx="40" ry="10" fill="url(#hpGreen)" />
      <path d="M22,88 Q60,72 98,88 L98,96 Q60,82 22,96 Z" fill="url(#hpGreen)" opacity="0.85" />
      <rect x="58.5" y="30" width="3" height="58" fill="url(#hpGold)" />
      <path d="M61.5,28 L92,38 L61.5,52 Z" fill="#E11D48" stroke="#7F1D1D" strokeWidth="1" />
      <ellipse cx="60" cy="90" rx="6" ry="2" fill="#000" opacity="0.35" />
    </svg>
  );
}

export default function Homepage() {
  const [trackInput, setTrackInput] = useState("");
  const [trackError, setTrackError] = useState("");

  function handleTrack(e) {
    e.preventDefault();
    const id = trackInput.trim();
    if (!id) {
      setTrackError("Masukkan Trip ID terlebih dahulu.");
      return;
    }
    setTrackError("");
    window.location.href = `/track/${encodeURIComponent(id)}`;
  }

  return (
    <div className="hp-root">
      {/* ── Header ── */}
      <header className="hp-header">
        <div className="hp-header-inner">
          <AALLogo size={48} />
          <div className="hp-brand">
            <span className="hp-brand-name">PT Alyssa Auto Logistik</span>
            <span className="hp-brand-tagline">Layanan Pengiriman Kendaraan Terpercaya</span>
          </div>
        </div>
        <nav className="hp-nav">
          <a className="hp-nav-link" href="/admin">Admin</a>
          <a className="hp-nav-link" href="/guide">Panduan</a>
          <a
            className="hp-nav-link hp-nav-wa"
            href="https://wa.me/628186311350"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="hp-hero">
        <div className="hp-hero-content">
          <h1 className="hp-hero-title">
            Kirim Kendaraan Anda<br />
            <span className="hp-gold">Aman &amp; Terpantau</span>
          </h1>
          <p className="hp-hero-sub">
            Kami mengantarkan kendaraan Anda ke seluruh Indonesia dengan sistem pelacakan real-time,
            dokumentasi lengkap, dan pembayaran transparan.
          </p>
          <a className="hp-btn hp-btn-primary" href="/order">
            Buat Pesanan Sekarang
          </a>
        </div>
      </section>

      {/* ── Tracking ── */}
      <section className="hp-section hp-track-section">
        <h2 className="hp-section-title">Lacak Pengiriman</h2>
        <p className="hp-section-sub">Masukkan Trip ID yang diberikan admin untuk melihat status pengiriman Anda.</p>
        <form className="hp-track-form" onSubmit={handleTrack}>
          <input
            className="hp-track-input"
            type="text"
            placeholder="Contoh: TRIP-AF291C"
            value={trackInput}
            onChange={e => { setTrackInput(e.target.value); setTrackError(""); }}
          />
          <button className="hp-btn hp-btn-gold" type="submit">Lacak</button>
        </form>
        {trackError && <p className="hp-track-error">{trackError}</p>}
      </section>

      {/* ── Features ── */}
      <section className="hp-section hp-features">
        <div className="hp-feature-card">
          <span className="hp-feature-icon">📍</span>
          <h3>Pelacakan Real-Time</h3>
          <p>Pantau posisi kendaraan Anda setiap hari melalui laporan foto dan GPS.</p>
        </div>
        <div className="hp-feature-card">
          <span className="hp-feature-icon">📋</span>
          <h3>Dokumen Lengkap</h3>
          <p>BASTK digital, foto serah terima, dan resi dikirimkan secara otomatis.</p>
        </div>
        <div className="hp-feature-card">
          <span className="hp-feature-icon">💳</span>
          <h3>Pembayaran Transparan</h3>
          <p>Pembayaran driver dilakukan bertahap dan terdokumentasi via Xendit.</p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="hp-section hp-cta">
        <h2 className="hp-section-title">Siap Kirimkan Kendaraan Anda?</h2>
        <div className="hp-cta-btns">
          <a className="hp-btn hp-btn-primary" href="/order">Buat Pesanan</a>
          <a
            className="hp-btn hp-btn-wa"
            href="https://wa.me/628186311350"
            target="_blank"
            rel="noreferrer"
          >
            Hubungi via WhatsApp
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="hp-footer">
        <p>© {new Date().getFullYear()} PT Alyssa Auto Logistik. Seluruh hak dilindungi.</p>
        <div className="hp-footer-links">
          <a href="/guide">Panduan Driver</a>
          <span>·</span>
          <a href="/admin">Admin Dashboard</a>
          <span>·</span>
          <a href="https://wa.me/628186311350" target="_blank" rel="noreferrer">WA 0818-631-135</a>
        </div>
      </footer>
    </div>
  );
}

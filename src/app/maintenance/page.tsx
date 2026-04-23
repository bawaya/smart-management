/* eslint-disable react/no-unknown-property */
import Image from 'next/image';

export const runtime = 'edge';

export const metadata = {
  title: 'System Upgrade · מובילי כלל המחוז',
  description: 'המערכת נמצאת בשדרוג. חוזרים בקרוב.',
  robots: { index: false, follow: false },
};

const KEYFRAMES = `
@keyframes orbitRing1 { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes orbitRing2 { from{transform:rotate(360deg)} to{transform:rotate(0deg)} }
@keyframes scanLine   { 0%{transform:translateY(-10vh);opacity:0} 8%{opacity:.9} 92%{opacity:.9} 100%{transform:translateY(110vh);opacity:0} }
@keyframes gridPan    { from{background-position:0 0} to{background-position:80px 80px} }
@keyframes blink      { 0%,60%{opacity:1} 30%{opacity:.25} }
@keyframes flicker    { 0%,100%{opacity:1} 50%{opacity:.6} }
@keyframes typein     { from{width:0} to{width:100%} }
@keyframes float1     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(8px,-12px)} }
@keyframes float2     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-10px,6px)} }
@keyframes glowPulse  { 0%,100%{filter:drop-shadow(0 0 30px rgba(245,158,11,.45)) drop-shadow(0 0 60px rgba(245,158,11,.2))} 50%{filter:drop-shadow(0 0 45px rgba(245,158,11,.7)) drop-shadow(0 0 90px rgba(245,158,11,.35))} }
`;

function TelemetryCard({
  label,
  value,
  accent = 'amber',
}: {
  label: string;
  value: string;
  accent?: 'amber' | 'emerald' | 'sky' | 'violet';
}) {
  const dotColor =
    accent === 'emerald'
      ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,.9)]'
      : accent === 'sky'
        ? 'bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,.9)]'
        : accent === 'violet'
          ? 'bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,.9)]'
          : 'bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,.9)]';

  return (
    <div className="relative rounded-lg border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
          style={{ animation: 'blink 1.4s ease-in-out infinite' }}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          {label}
        </span>
      </div>
      <div className="font-mono text-sm font-bold text-white">{value}</div>
    </div>
  );
}

export default function MaintenancePage() {
  const buildTag = `v0.1.0-build.${Math.floor(Date.now() / 1000).toString(36).toUpperCase()}`;
  const regionTag = 'EU-CENTRAL';
  const year = new Date().getFullYear();

  return (
    <main
      dir="ltr"
      className="relative min-h-screen w-full overflow-hidden bg-[#05070c] text-white selection:bg-amber-500/40"
    >
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* LAYER 1 — animated blueprint grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(251,191,36,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.28) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          animation: 'gridPan 20s linear infinite',
          maskImage:
            'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      {/* LAYER 2 — radial amber glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.06) 30%, transparent 60%)',
        }}
      />

      {/* LAYER 3 — corner HUD brackets */}
      <div className="pointer-events-none absolute inset-4 md:inset-8">
        <CornerBracket pos="tl" />
        <CornerBracket pos="tr" />
        <CornerBracket pos="bl" />
        <CornerBracket pos="br" />
      </div>

      {/* LAYER 4 — horizontal scan line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.9) 50%, transparent 100%)',
          boxShadow: '0 0 18px rgba(251,191,36,0.6)',
          animation: 'scanLine 6s linear infinite',
        }}
      />

      {/* LAYER 5 — top status bar */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/5 bg-black/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 backdrop-blur-md md:px-8">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
            style={{ animation: 'blink 1.2s ease-in-out infinite' }}
          />
          <span className="text-amber-300/80">SYSTEM · UPGRADE MODE</span>
        </div>
        <div className="hidden items-center gap-5 sm:flex">
          <span>REGION {regionTag}</span>
          <span>BUILD {buildTag}</span>
        </div>
      </div>

      {/* LAYER 6 — main content */}
      <section className="relative z-10 flex min-h-[calc(100vh-32px)] flex-col items-center justify-center px-6 py-16">
        {/* Badge */}
        <div className="mb-10 inline-flex items-center gap-3 rounded-full border border-amber-400/30 bg-amber-500/5 px-5 py-1.5 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-200">
            Deployment in Progress
          </span>
        </div>

        {/* Logo + orbital rings */}
        <div className="relative mb-10 flex h-72 w-72 items-center justify-center md:h-80 md:w-80">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full border border-amber-400/20"
            style={{ animation: 'orbitRing1 28s linear infinite' }}
          >
            <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.9)]" />
          </div>
          <div
            aria-hidden
            className="absolute inset-6 rounded-full border border-dashed border-amber-400/15"
            style={{ animation: 'orbitRing2 36s linear infinite' }}
          >
            <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
          </div>
          <div
            aria-hidden
            className="absolute inset-12 rounded-full border border-amber-400/10"
            style={{ animation: 'orbitRing1 48s linear infinite reverse' }}
          />

          <div
            className="relative z-10 h-44 w-44 md:h-52 md:w-52"
            style={{ animation: 'glowPulse 3.5s ease-in-out infinite' }}
          >
            <Image
              src="/clal-logo.png"
              alt="Movil Clal Hamahoz Ltd"
              fill
              priority
              sizes="208px"
              className="object-contain"
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="mb-3 text-center font-mono text-xs uppercase tracking-[0.4em] text-white/40">
          SMART MANAGEMENT · SYSTEM UPGRADE
        </h1>

        <h2 className="mb-6 bg-gradient-to-b from-white via-amber-100 to-amber-300 bg-clip-text text-center text-4xl font-black tracking-tight text-transparent sm:text-5xl md:text-6xl">
          מערכת בשדרוג
        </h2>

        <p className="mb-10 max-w-xl text-center text-base leading-relaxed text-white/60 sm:text-lg">
          אנחנו משדרגים את הפלטפורמה לגרסה הבאה.
          <br />
          המערכת תחזור לאוויר בזמן הקרוב עם חוויה מתקדמת יותר.
        </p>

        {/* Terminal */}
        <div className="mb-10 w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-black/70 shadow-2xl shadow-amber-950/30 backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-white/5 bg-white/5 px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
              deploy@movil-clal ~ smart-management
            </span>
          </div>
          <div className="px-5 py-4 font-mono text-xs leading-relaxed sm:text-sm">
            <TerminalLine delay="0s" duration="1.8s" color="text-emerald-300">
              <span className="text-white/30">$</span> git pull origin master
            </TerminalLine>
            <TerminalLine delay="2s" duration="1.6s" color="text-sky-300">
              <span className="text-white/30">$</span> npm run build
              <span className="text-white/40"> · compiling 127 modules</span>
            </TerminalLine>
            <TerminalLine delay="3.8s" duration="1.4s" color="text-amber-300">
              <span className="text-white/30">$</span> wrangler pages deploy
              <span className="text-white/40"> · edge network</span>
            </TerminalLine>
            <TerminalLine delay="5.4s" duration="1.2s" color="text-fuchsia-300">
              <span className="text-white/30">$</span> running migrations
              <span className="text-white/40"> · d1 database</span>
            </TerminalLine>
            <TerminalLine delay="6.8s" duration="1s" color="text-emerald-300">
              <span className="text-white/30">$</span> status: <span className="text-amber-300">DEPLOYING</span>
              <span
                className="ml-1 inline-block h-3 w-[6px] translate-y-0.5 bg-amber-300 align-middle"
                style={{ animation: 'blink 1s steps(2,start) infinite' }}
              />
            </TerminalLine>
          </div>
        </div>

        {/* Telemetry */}
        <div className="grid w-full max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
          <TelemetryCard label="Uptime SLA" value="99.9%" accent="emerald" />
          <TelemetryCard label="Status" value="UPGRADING" accent="amber" />
          <TelemetryCard label="Region" value={regionTag} accent="sky" />
          <TelemetryCard label="ETA" value="SHORTLY" accent="violet" />
        </div>

        {/* Credits */}
        <footer
          dir="rtl"
          className="mt-16 flex flex-col items-center gap-2 border-t border-white/5 pt-8 text-center"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
            Designed &amp; Engineered by
          </div>
          <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
            <span className="text-base font-semibold text-white sm:text-lg">
              תכנון וביצוע · מובילי כלל המחוז בע״מ
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-amber-400 sm:inline-block" />
            <span className="text-base text-amber-300/90 sm:text-lg">
              מוחמד באוואייה
            </span>
          </div>
          <div className="mt-2 font-mono text-[10px] tracking-[0.25em] text-white/25">
            © {year} · All Rights Reserved
          </div>
        </footer>
      </section>

      {/* Floating accent dots */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[8%] top-[22%] h-1.5 w-1.5 rounded-full bg-amber-400"
        style={{ animation: 'float1 6s ease-in-out infinite, blink 2s infinite' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[10%] top-[35%] h-1 w-1 rounded-full bg-sky-400"
        style={{ animation: 'float2 8s ease-in-out infinite' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[18%] left-[12%] h-1 w-1 rounded-full bg-fuchsia-400"
        style={{ animation: 'float1 7s ease-in-out infinite' }}
      />
    </main>
  );
}

function CornerBracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute h-8 w-8 border-amber-400/40';
  const variants: Record<typeof pos, string> = {
    tl: 'top-0 left-0 border-t border-l',
    tr: 'top-0 right-0 border-t border-r',
    bl: 'bottom-0 left-0 border-b border-l',
    br: 'bottom-0 right-0 border-b border-r',
  };
  return (
    <div
      className={`${base} ${variants[pos]}`}
      style={{ animation: 'flicker 3s ease-in-out infinite' }}
    />
  );
}

function TerminalLine({
  children,
  delay,
  duration,
  color,
}: {
  children: React.ReactNode;
  delay: string;
  duration: string;
  color: string;
}) {
  return (
    <div className={`overflow-hidden whitespace-nowrap ${color}`}>
      <span
        className="inline-block overflow-hidden whitespace-nowrap align-top"
        style={{
          width: '0',
          animation: `typein ${duration} steps(60, end) forwards`,
          animationDelay: delay,
        }}
      >
        {children}
      </span>
    </div>
  );
}

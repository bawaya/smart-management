export const runtime = 'edge';

export const metadata = {
  title: 'בקרוב | ניהול חכם',
  description: 'האתר בתהליכי שדרוג — נחזור בקרוב',
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.25),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(251,191,36,0.15),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-amber-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-orange-500/10 blur-3xl"
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-amber-400/30 bg-amber-500/10 px-5 py-2 backdrop-blur-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>
          <span className="text-sm font-medium text-amber-200">
            האתר בתהליך שדרוג
          </span>
        </div>

        <div className="mb-10 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-2xl shadow-amber-500/40 ring-1 ring-white/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-14 w-14 text-slate-900"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M11.983 1.904a.75.75 0 0 1 1.06 1.06l-.53.53 1.14 1.141a.75.75 0 0 1-1.06 1.06l-.42-.42-1.36 1.36 5.4 5.4a3.75 3.75 0 0 1-5.304 5.304l-5.4-5.4-1.36 1.36.42.42a.75.75 0 0 1-1.06 1.06l-1.14-1.14-.53.53a.75.75 0 1 1-1.06-1.06l1.59-1.59 2.23-2.23 2.51-2.51 2.23-2.23 1.59-1.59Z" />
          </svg>
        </div>

        <h1 className="mb-4 bg-gradient-to-br from-white via-amber-100 to-amber-300 bg-clip-text text-center text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl md:text-7xl">
          ניהול חכם
        </h1>

        <p className="mb-3 text-center text-xl font-medium text-amber-100 sm:text-2xl">
          אנחנו בונים משהו מיוחד
        </p>

        <p className="mb-12 max-w-xl text-center text-base leading-relaxed text-slate-300 sm:text-lg">
          האתר נמצא כרגע בשלבי פיתוח אחרונים.
          <br />
          נחזור אליכם בקרוב עם חוויה מקצועית וחדשה.
        </p>

        <div
          className="mb-12 flex items-center gap-3"
          aria-label="טוען"
          role="status"
        >
          <span
            className="h-3 w-3 animate-bounce rounded-full bg-amber-400"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-3 w-3 animate-bounce rounded-full bg-amber-400"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-3 w-3 animate-bounce rounded-full bg-amber-400"
            style={{ animationDelay: '300ms' }}
          />
        </div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          <FeatureCard
            title="מהיר"
            desc="ביצועים גבוהים"
            icon={
              <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" />
            }
          />
          <FeatureCard
            title="חכם"
            desc="אוטומציה מתקדמת"
            icon={
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-6h2Zm0-8h-2V7h2Z" />
            }
          />
          <FeatureCard
            title="מאובטח"
            desc="הצפנה מלאה"
            icon={
              <path d="M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5Z" />
            }
          />
        </div>

        <p
          dir="rtl"
          className="mt-16 text-center text-sm text-slate-400"
        >
          © {new Date().getFullYear()} ניהול חכם · כל הזכויות שמורות
        </p>
      </div>
    </main>
  );
}

function FeatureCard({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:border-amber-400/40 hover:bg-white/10">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 transition group-hover:bg-amber-500/30">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          {icon}
        </svg>
      </div>
      <div className="text-base font-semibold text-white">{title}</div>
      <div className="text-sm text-slate-400">{desc}</div>
    </div>
  );
}

import { IconCheckCircle, IconClock, IconLightbulb, IconUsers } from './icons';

/** Decorative product illustration for the landing page (pure SVG + markup). */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[44px] bg-gradient-to-br from-sky-100 via-teal-50 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-[32px] border border-navy/[0.08] bg-white shadow-lift">
        <svg viewBox="0 0 520 420" className="block h-auto w-full dark:hue-rotate-180 dark:invert-[.9]">
          <defs>
            <pattern id="blocks" width="70" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(-17)">
              <rect width="70" height="70" fill="#F4F6F8" />
              <rect x="6" y="6" width="58" height="58" rx="6" fill="#ECEFF3" />
            </pattern>
            <linearGradient id="park" x1="0" x2="1">
              <stop offset="0" stopColor="#D3EEEA" />
              <stop offset="1" stopColor="#E6F4F1" />
            </linearGradient>
          </defs>
          <rect width="520" height="420" fill="url(#blocks)" />
          <path d="M330 40c60-10 140 10 170 60v90c-50 10-110-10-150-40-30-24-40-80-20-110z" fill="url(#park)" />
          <path d="M-20 310c80-30 160-20 230 20s160 60 330 10v100H-20z" fill="#DCEBFA" opacity=".7" />
          <g stroke="#fff" strokeWidth="14" strokeLinecap="round" fill="none">
            <path d="M-10 250 530 90" />
            <path d="M60 -10 200 430" />
            <path d="M260 -10 380 430" />
          </g>
          {/* alternative routes */}
          <path d="M96 330c40-40 70-70 110-90s80-30 110-70 40-70 80-90" fill="none" stroke="#3E7CB1" strokeWidth="5" strokeLinecap="round" strokeOpacity=".35" strokeDasharray="0" />
          <path d="M96 330c10-60 40-110 100-130s120 10 160-40 30-70 40-80" fill="none" stroke="#7B6CB1" strokeWidth="5" strokeLinecap="round" strokeOpacity=".3" />
          {/* selected route */}
          <path d="M96 330c30-20 60-30 90-60s50-70 90-80 80 0 110-40 20-50 20-70" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
          <path className="hero-route" d="M96 330c30-20 60-30 90-60s50-70 90-80 80 0 110-40 20-50 20-70" fill="none" stroke="#3A9487" strokeWidth="7" strokeLinecap="round" />
          {/* streetlights */}
          {[[170, 285], [250, 196], [330, 178], [392, 128]].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="14" fill="#FAEACB" opacity=".7" />
              <circle cx={x} cy={y} r="4" fill="#D69A2D" />
            </g>
          ))}
          <circle cx="96" cy="330" r="9" fill="#172B4D" stroke="#fff" strokeWidth="4" />
          <g transform="translate(406 40)">
            <path d="M10 34S0 25 0 12a10 10 0 1 1 20 0C20 25 10 34 10 34z" fill="#172B4D" stroke="#fff" strokeWidth="2" />
            <circle cx="10" cy="12" r="4" fill="#fff" />
          </g>
        </svg>

        <div className="absolute left-4 right-4 top-4 flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-soft ring-1 ring-navy/[0.05] sm:left-5 sm:right-auto sm:w-[270px]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><IconLightbulb size={20} /></span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-navy">Via King St · 18 min</p>
            <p className="text-[12px] text-slate-500">82% mapped lighting · no active reports</p>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 grid gap-2 sm:left-auto sm:w-[250px]">
          <div className="flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-soft ring-1 ring-navy/[0.05]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-navy"><IconUsers size={18} /></span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-navy">Shared with Jordan</p>
              <p className="text-[12px] text-slate-500">Until you arrive</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-navy p-3 text-white shadow-soft">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-teal-200"><IconClock size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold">Arrival check-in</p>
              <p className="text-[12px] text-sky-200">Expected 9:40 PM</p>
            </div>
            <IconCheckCircle size={20} className="text-teal-200" />
          </div>
        </div>
      </div>
      <style>{`
        .hero-route { stroke-dasharray: 600; stroke-dashoffset: 600; animation: draw 1.6s ease-out .3s forwards; }
        @keyframes draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .hero-route { animation: none; stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}

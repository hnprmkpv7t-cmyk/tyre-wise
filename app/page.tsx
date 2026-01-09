"use client";

import Image from "next/image";
import React, { useMemo, useState } from "react";

const DEMO_VRM = "Y14 DRT";
const OEM_TYRE = "265/30 R20";

// Geometry-only safety limits (no LI/SR filter)
const LIMITS = {
  diameterPctMax: 3.0,
  widthDeltaMaxMm: 25,
  aspectDeltaMaxForFullPenalty: 10,
  minScoreShown: 65,
} as const;

type Tyre = { widthMm: number; aspect: number; rimIn: number };

function normalise(s: string) {
  return String(s).trim().toUpperCase().replaceAll(" ", "");
}

function parseTyreSize(input: string): Tyre | null {
  // Accept: "265/30 R20" or "265/30R20"
  const s = normalise(input);
  const parts = s.split("R");
  if (parts.length !== 2) return null;

  const left = parts[0]; // 265/30
  const rimStr = parts[1]; // 20
  const lr = left.split("/");
  if (lr.length !== 2) return null;

  const widthMm = Number(lr[0]);
  const aspect = Number(lr[1]);
  const rimIn = Number(rimStr);

  if (!Number.isFinite(widthMm) || !Number.isFinite(aspect) || !Number.isFinite(rimIn)) return null;
  if (String(widthMm).length !== 3) return null;
  if (aspect < 10 || aspect > 95) return null;
  if (rimIn < 10 || rimIn > 30) return null;

  return { widthMm, aspect, rimIn };
}

function formatTyreSize(t: Tyre) {
  return `${t.widthMm}/${String(t.aspect).padStart(2, "0")} R${t.rimIn}`;
}

function overallDiameterMm(t: Tyre) {
  const rimMm = t.rimIn * 25.4;
  const sidewallMm = t.widthMm * (t.aspect / 100);
  return rimMm + 2 * sidewallMm;
}

function pctDiff(a: number, b: number) {
  return Math.abs((b - a) / a) * 100;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function sizeToSlug(size: string) {
  const t = parseTyreSize(size);
  if (!t) return null;
  return `${t.widthMm}-${String(t.aspect).padStart(2, "0")}-${t.rimIn}`;
}

function retailerLinksForSize(size: string) {
  const slug = sizeToSlug(size);
  if (!slug) return { blackcircles: null as string | null, national: null as string | null };

  return {
    blackcircles: `https://www.blackcircles.com/tyres/${slug}`,
    national: `https://www.national.co.uk/tyres-search/${slug}`,
  };
}

function scoreAlternative(oem: Tyre, alt: Tyre) {
  const oemDia = overallDiameterMm(oem);
  const altDia = overallDiameterMm(alt);
  const diaDiffPct = pctDiff(oemDia, altDia);

  if (diaDiffPct > LIMITS.diameterPctMax) {
    return { safe: false, score: 0, reasons: [`Diameter Δ ${diaDiffPct.toFixed(2)}% (limit ${LIMITS.diameterPctMax}%)`] };
  }

  if (alt.rimIn !== oem.rimIn) {
    return { safe: false, score: 0, reasons: ["Rim size differs from OEM"] };
  }

  const widthDelta = Math.abs(alt.widthMm - oem.widthMm);
  if (widthDelta > LIMITS.widthDeltaMaxMm) {
    return { safe: false, score: 0, reasons: [`Width Δ ${widthDelta}mm (limit ±${LIMITS.widthDeltaMaxMm}mm)`] };
  }

  // Score weights: diameter 55, width 25, aspect 20
  const diaPenalty = clamp((diaDiffPct / LIMITS.diameterPctMax) * 55, 0, 55);
  const widthPenalty = clamp((widthDelta / LIMITS.widthDeltaMaxMm) * 25, 0, 25);
  const aspectDelta = Math.abs(alt.aspect - oem.aspect);
  const aspectPenalty = clamp((aspectDelta / LIMITS.aspectDeltaMaxForFullPenalty) * 20, 0, 20);

  const score = clamp(Math.round(100 - (diaPenalty + widthPenalty + aspectPenalty)), 0, 100);

  return {
    safe: true,
    score,
    reasons: [`Diameter Δ ${diaDiffPct.toFixed(2)}%`, `Width Δ ${widthDelta}mm`, `Aspect Δ ${aspectDelta}`],
  };
}

function scoreLabel(score: number) {
  if (score >= 90) return { text: "S-Tier Fit", color: "bg-emerald-500" };
  if (score >= 80) return { text: "Great Fit", color: "bg-lime-500" };
  if (score >= 70) return { text: "OK Fit", color: "bg-amber-500" };
  return { text: "Nope", color: "bg-rose-500" };
}

function ScoreBadge({ score }: { score: number }) {
  const s = scoreLabel(score);
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 h-16 bg-white rounded-md border-4 border-slate-900 grid place-items-center">
        <div className="text-xl text-slate-900 leading-none">{score}</div>
      </div>
      <div className="min-w-0">
        <div className={`inline-block px-3 py-1 rounded-md border-4 border-slate-900 text-slate-900 ${s.color}`}>
          {s.text}
        </div>
        <div className="text-xs text-white/90 mt-2">Suitability score (0–100)</div>
      </div>
    </div>
  );
}

function PixelNavButton({ label }: { label: string }) {
  return (
    <button className="pixel-btn px-4 py-2 bg-orange-400 text-slate-900 rounded-md hover:bg-orange-300">
      {label}
    </button>
  );
}

function ExternalLink({
  href,
  label,
  recommended,
}: {
  href: string | null;
  label: string;
  recommended?: boolean;
}) {
  return (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={[
        "pixel-btn block rounded-md px-4 py-3",
        "bg-slate-100 text-slate-900 hover:bg-white",
        "transition",
        !href ? "opacity-60 pointer-events-none" : "",
        recommended ? "ring-4 ring-yellow-300" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs">{label}</div>
        {recommended ? <div className="text-xs">★</div> : null}
      </div>
      <div className="mt-2 text-sm">SHOW PRICES</div>
      <div className="mt-1 text-[10px] opacity-70">opens new tab</div>
    </a>
  );
}

export default function Page() {
  const [vrm, setVrm] = useState("");
  const [error, setError] = useState("");
  const [oem, setOem] = useState<null | { vrm: string; tyre: string }>(null);
  const [alts, setAlts] = useState<
    { size: string; score: number; reasons: string[]; links: ReturnType<typeof retailerLinksForSize> }[]
  >([]);

  const logoExists = true; // set false if you don't add /public/logo.png yet

  const oemLinks = useMemo(() => retailerLinksForSize(OEM_TYRE), []);

  function runSearch() {
    setError("");
    const v = vrm.trim().toUpperCase();

    if (v !== DEMO_VRM) {
      setOem(null);
      setAlts([]);
      setError(`DEMO ONLY: try "${DEMO_VRM}"`);
      return;
    }

    const parsedOEM = parseTyreSize(OEM_TYRE);
    if (!parsedOEM) {
      setError("OEM tyre size invalid in demo.");
      return;
    }

    // Candidate generation: nearby widths/aspects (same rim)
    const widths = [-20, -10, 10, 20];
    const aspects = [-5, 5];

    const candidates: Tyre[] = [];
    for (const dw of widths) candidates.push({ ...parsedOEM, widthMm: parsedOEM.widthMm + dw });
    for (const da of aspects) candidates.push({ ...parsedOEM, aspect: parsedOEM.aspect + da });

    // a couple of combos
    candidates.push({ ...parsedOEM, widthMm: parsedOEM.widthMm - 10, aspect: parsedOEM.aspect - 5 });
    candidates.push({ ...parsedOEM, widthMm: parsedOEM.widthMm + 10, aspect: parsedOEM.aspect - 5 });

    const seen = new Set<string>();
    const scored = candidates
      .map((t) => ({ t, size: formatTyreSize(t) }))
      .filter((x) => x.size !== OEM_TYRE)
      .filter((x) => {
        if (seen.has(x.size)) return false;
        seen.add(x.size);
        return true;
      })
      .map((x) => {
        const s = scoreAlternative(parsedOEM, x.t);
        return {
          size: x.size,
          score: s.score,
          reasons: s.reasons,
          safe: s.safe,
          links: retailerLinksForSize(x.size),
        };
      })
      .filter((x) => x.safe && x.score >= LIMITS.minScoreShown)
      .sort((a, b) => b.score - a.score)
      .map(({ safe, ...rest }) => rest);

    setOem({ vrm: v, tyre: OEM_TYRE });
    setAlts(scored);
  }

  return (
    <main className="min-h-screen p-4">
      {/* PIXEL WINDOW */}
      <div className="pixel-window max-w-5xl mx-auto bg-[#0c1a3a]">
        {/* TOP BAR */}
        <div className="pixel-bar px-4 py-3 flex items-center justify-between text-slate-900">
          <div className="flex items-center gap-2">
            <span className="pixel-dot bg-red-400" />
            <span className="pixel-dot bg-yellow-400" />
            <span className="pixel-dot bg-green-400" />
          </div>
          <div className="text-xs opacity-70">TyreWise.com</div>
          <div className="text-xs opacity-70">▢</div>
        </div>

        {/* CONTENT */}
        <div
          className="relative"
          style={{
            background:
              "linear-gradient(#2b5cff, #3aa7ff 55%, #5de3ff 70%, #3ad84e 70%, #2fb542 78%, #1b1730 78%)",
          }}
        >
          {/* clouds (pixel-ish blocks) */}
          <div className="absolute inset-0 pointer-events-none opacity-70">
            <div className="absolute top-10 left-8 w-32 h-10 bg-white/70 rounded-md blur-[0.5px]" />
            <div className="absolute top-20 right-10 w-40 h-12 bg-white/60 rounded-md blur-[0.5px]" />
            <div className="absolute top-40 left-40 w-28 h-10 bg-white/60 rounded-md blur-[0.5px]" />
          </div>

          {/* NAV */}
          <div className="relative z-10 px-6 pt-6 flex gap-3 flex-wrap">
            <PixelNavButton label="HOME" />
            <PixelNavButton label="ABOUT" />
            <PixelNavButton label="HOW" />
            <PixelNavButton label="CONTACT" />
          </div>

          {/* HERO */}
          <div className="relative z-10 px-6 pt-6 pb-4 flex flex-col items-center text-center">
            <div className="flex items-center gap-4">
              {/* logo */}
              <div className="pixel-btn bg-white rounded-md p-2 border-4 border-slate-900">
                {logoExists ? (
                  <Image
                    src="/logo.png"
                    alt="Tyre Wise logo"
                    width={120}
                    height={60}
                    className="pixelated"
                  />
                ) : (
                  <div className="text-slate-900 text-sm px-3 py-2">🧙‍♂️🛞</div>
                )}
              </div>

              <div className="text-left">
                <div className="text-3xl text-white drop-shadow">TYRE WISE</div>
                <div className="text-xs text-white/90 mt-2">
                  safer size options • scored 0–100 • no price scraping
                </div>
              </div>
            </div>

            {/* search box */}
            <div className="mt-6 w-full max-w-3xl">
              <div className="pixel-btn bg-slate-100 border-4 border-slate-900 rounded-md p-3">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                  <div className="flex-1">
                    <div className="text-[10px] text-slate-700 mb-2">ENTER REGISTRATION</div>
                    <input
                      value={vrm}
                      onChange={(e) => setVrm(e.target.value)}
                      placeholder="e.g. Y14 DRT"
                      className="w-full px-4 py-3 rounded-md border-4 border-slate-900 bg-white text-slate-900 outline-none"
                    />
                    {error ? <div className="mt-2 text-xs text-rose-700">{error}</div> : null}
                    {!error ? (
                      <div className="mt-2 text-[10px] text-slate-600">
                        demo: <span className="font-bold">{DEMO_VRM}</span>
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={runSearch}
                    className="pixel-btn bg-yellow-300 hover:bg-yellow-200 text-slate-900 border-4 border-slate-900 rounded-md px-6 py-4"
                  >
                    CHECK SCORE
                  </button>
                </div>
              </div>
            </div>

            {/* car road + gif */}
            <div className="mt-6 w-full max-w-3xl">
              <div className="pixel-road">
                {/* road stripe */}
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#2a2a2a] border-t-4 border-slate-900" />
                <div className="absolute bottom-[10px] left-0 right-0 h-[4px] bg-yellow-300 opacity-80" />
                <img src="/pixel-car.gif" alt="" className="pixel-car pixelated" />
              </div>
            </div>
          </div>

          {/* RESULTS PANEL */}
          <div className="relative z-10 px-6 pb-10">
            <div className="pixel-btn bg-[#14102a] border-4 border-slate-900 rounded-md p-5">
              {!oem ? (
                <div className="text-white text-xs">
                  Enter <span className="text-yellow-300">Y14 DRT</span> to view the demo OEM size and alternatives.
                </div>
              ) : (
                <>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div>
                      <div className="text-xs text-white/80">OEM TYRE SIZE</div>
                      <div className="text-2xl text-white mt-3">{oem.tyre}</div>
                      <div className="text-[10px] text-white/70 mt-2">VRM: {oem.vrm}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[280px]">
                      <ExternalLink href={oemLinks.blackcircles} label="BLACKCIRCLES" recommended />
                      <ExternalLink href={oemLinks.national} label="NATIONAL TYRES" />
                    </div>
                  </div>

                  <div className="mt-5 text-[10px] text-white/70">
                    Suitability scoring is based on geometry vs OEM only. Always confirm fitment with a professional.
                  </div>
                </>
              )}
            </div>

            {/* alternatives */}
            {oem ? (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {alts.map((a, i) => (
                  <div key={a.size} className="pixel-btn bg-slate-100 border-4 border-slate-900 rounded-md p-4 text-slate-900">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs opacity-70">ALTERNATIVE SIZE</div>
                        <div className="text-lg mt-2">{a.size}</div>
                        <div className="mt-3">
                          <ScoreBadge score={a.score} />
                        </div>
                        <div className="mt-4 text-[10px] opacity-80">
                          WHY:
                          <ul className="mt-2 space-y-1">
                            {a.reasons.map((r, idx) => (
                              <li key={idx}>• {r}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="min-w-[170px] flex flex-col gap-3">
                        <ExternalLink
                          href={a.links.blackcircles}
                          label="BLACKCIRCLES"
                          recommended={i === 0}
                        />
                        <ExternalLink href={a.links.national} label="NATIONAL" />
                      </div>
                    </div>
                  </div>
                ))}

                {alts.length === 0 ? (
                  <div className="md:col-span-2 pixel-btn bg-slate-100 border-4 border-slate-900 rounded-md p-5 text-slate-900">
                    <div className="text-lg">NO SAFE ALTERNATIVES FOUND</div>
                    <div className="text-xs mt-3 opacity-80">
                      Some performance sizes have very little tolerance for changes. We only show options within strict limits.
                    </div>
                    <div className="text-xs mt-3 opacity-80">
                      Tip: stick with OEM size and compare different tyre models/brands.
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-8 text-center text-[10px] text-white/70">
              © TYRE WISE — demo UI. Retailer links open live pages (no scraping).
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


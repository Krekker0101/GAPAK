"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Layers3, ShieldCheck, Sparkles } from "lucide-react";

import { LocaleLink } from "@/shared/i18n/locale-link";
import { useI18n } from "@/shared/i18n/provider";

const videoSource = new URL("../../../../video/v1.mp4", import.meta.url).toString();
const logoSource = new URL("../../../../img/logo.png", import.meta.url).toString();

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  aside?: ReactNode;
};

export function AuthShell({ title, description, children, footer, aside }: AuthShellProps) {
  const { t } = useI18n();
  const [pointer, setPointer] = useState({ x: 50, y: 45 });

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      setPointer({ x, y });
    };

    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // set day/night on root for adaptive pearlescent effect
  useEffect(() => {
    const setTime = () => {
      const h = new Date().getHours();
      const mode = h >= 7 && h < 19 ? "day" : "night";
      document.documentElement.setAttribute("data-time", mode);
    };
    setTime();
    const id = setInterval(setTime, 60_000);
    return () => clearInterval(id);
  }, []);

  const heroStyle = useMemo(
    () => ({
      background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(255,45,149,0.06), transparent 18%), radial-gradient(circle at 82% 18%, rgba(124,58,237,0.05), transparent 20%), linear-gradient(180deg, rgb(var(--background)), rgba(255,255,255,0.6))`,
    }),
    [pointer.x, pointer.y],
  );

  const highlights = [
    { icon: ShieldCheck, title: "Session-aware auth", description: "Secure refresh lifecycle, guarded routes, and a premium sign-in flow." },
    { icon: Layers3, title: "Visibility control", description: "Privacy layers, trusted circles, and room-aware presence built into the UX." },
    { icon: Sparkles, title: "Premium UX", description: "Cinematic motion, glass surfaces, and light-responsive interactions across every screen." },
  ];

  // photo assets (use images from front/img) — 4 thumbnails
  const photoSources = [
    new URL("../../../../img/1.png", import.meta.url).toString(),
    new URL("../../../../img/2.png", import.meta.url).toString(),
    new URL("../../../../img/3.png", import.meta.url).toString(),
    new URL("../../../../img/4.png", import.meta.url).toString(),
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--page-bg)]" style={heroStyle as CSSProperties}>
      {/* decorative animated orbs */}
      <div className="orb-wrapper absolute -left-28 -top-16 h-96 w-96 rounded-full filter blur-2xl animate-orb float-slow">
        <div className="orb-bg h-full w-full rounded-full bg-gradient-to-br from-[rgba(255,45,149,0.18)] to-[rgba(124,58,237,0.12)]" />
        {/* logo anchored to orb - never detaches visually */}
        <div className="orb-logo pointer-events-none">
          <img src={logoSource} alt="Gapak" width={88} height={88} />
        </div>
      </div>
      <div className="absolute -right-24 top-12 h-80 w-80 rounded-full bg-gradient-to-br from-[rgba(102,244,255,0.14)] to-[rgba(255,178,244,0.12)] filter blur-2xl animate-orb float-slower" />

      <style>{` 
        .animated-title{display:block;background:linear-gradient(90deg,var(--primary) 0%,var(--secondary) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;letter-spacing:-0.02em;animation:titleReveal 900ms cubic-bezier(.2,.9,.2,1) both}
        @keyframes titleReveal{from{transform:translateY(18px) scale(.98);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}

        .animate-orb{animation:orbMove 7s ease-in-out infinite, orbPulse 6s ease-in-out infinite}
        @keyframes orbMove{0%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-30px) rotate(8deg)}100%{transform:translateY(0) rotate(0deg)}}
        @keyframes orbPulse{0%{filter:brightness(1)}50%{filter:brightness(1.2)}100%{filter:brightness(1)}}

        .float-slow{animation-duration:12s}.float-slower{animation-duration:18s}

        .glass-panel{background:linear-gradient(180deg,rgba(255,255,255,0.9),rgba(245,245,247,0.9));backdrop-filter:blur(10px);box-shadow:0 10px 40px rgba(20,21,30,0.08);border:1px solid rgba(15,15,20,0.04)}

        .auth-cta{display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(90deg,var(--accent),var(--primary));box-shadow:0 8px 30px rgba(255,165,0,0.12);transition:transform .28s ease,box-shadow .28s ease}
        .auth-cta:hover{transform:translateY(-4px);box-shadow:0 18px 40px rgba(0,0,0,0.12)}
        .auth-cta:active{transform:translateY(-1px)}

        .sr-only{position:absolute!important;height:1px;width:1px;overflow:hidden;clip:rect(1px,1px,1px,1px);white-space:nowrap;border:0;padding:0;margin:-1px}
      `}</style>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] lg:items-center">
          <div className="space-y-6 left-column">
            <div className="inline-flex items-center gap-6">
              <div className="h-36 w-36 rounded-full bg-gradient-to-br from-primary to-secondary shadow-2xl animate-orb" aria-hidden="true" />
              <span className="sr-only">Gapak</span>
            </div>

            <div className="max-w-2xl space-y-4 left-hero-wrap relative">
              {/* big rectangular tile (target for photo attachments) */}
              <div className="hero-tile h-[420px] w-[420px] rounded-2xl bg-gradient-to-br from-white/95 to-gray-100 shadow-2xl relative overflow-visible">
                {/* attach photo-stack here */}
                <div className="photo-stack-left" aria-hidden="true">
                  {photoSources.map((src, i) => (
                    <img key={i} src={src} alt={`left-preview-${i+1}`} className="photo-left" style={{ ['--i' as any]: i, ['--start' as any]: `${i * 72}deg` }} />
                  ))}
                </div>
              </div>

              <span className="sr-only">Gapak — private social OS</span>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* minimal UI: visual chips hidden visually, kept for semantics */}
              <span className="sr-only">Features: Live visuals, Premium UI, Adaptive auth</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item.title} className="glass-surface p-4 flex flex-col items-center">
                  <item.icon className="h-6 w-6 text-primary" />
                  <span className="sr-only">{item.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/70 to-gray-100/70 pointer-events-none" />
              <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-tr from-primary/24 to-secondary/20 blur-lg animate-orb float-slow" />
            </div>
            <div className="glass-panel relative rounded-[2.5rem] p-5 shadow-glow sm:p-7" style={{ ['--pointer-x' as any]: pointer.x, ['--pointer-y' as any]: pointer.y }}>
              {/* rim + sheen + micro bubble placeholders */}
              <div className="rim" />
              <div className="sheen" />
              <div className="micro-bubble" />

              {/* photos attached to panel (rotating cluster) */}
              <div className="photo-stack" aria-hidden="true" tabIndex={-1}>
                {photoSources.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`preview-${i+1}`}
                    className="photo"
                    style={{ ['--i' as any]: i, ['--start' as any]: `${i * 72}deg` }}
                  />
                ))}
              </div>

              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="sr-only">Access vault — Cinematic sign-in experience</span>
                </div>
                {aside}
              </div>

              <div className="space-y-1">
                <h2 className="sr-only">{title}</h2>
                <p className="sr-only">{description}</p>
              </div>

              <div className="mt-6 space-y-5">{children}</div>

              <div className="mt-6 border-t border-white/8 pt-5 text-sm text-muted-foreground">{footer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

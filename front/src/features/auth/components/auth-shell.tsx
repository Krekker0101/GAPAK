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

  const heroStyle = useMemo(
    () => ({
      background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, rgba(102,244,255,0.18), transparent 22%), radial-gradient(circle at 82% 18%, rgba(255,178,244,0.15), transparent 18%), linear-gradient(135deg, rgba(3, 6, 10, 0.9), rgba(7, 11, 18, 0.86))`,
    }),
    [pointer.x, pointer.y],
  );

  const highlights = [
    { icon: ShieldCheck, title: "Session-aware auth", description: "Secure refresh lifecycle, guarded routes, and a premium sign-in flow." },
    { icon: Layers3, title: "Visibility control", description: "Privacy layers, trusted circles, and room-aware presence built into the UX." },
    { icon: Sparkles, title: "Premium UX", description: "Cinematic motion, glass surfaces, and light-responsive interactions across every screen." },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#03060b]" style={heroStyle as CSSProperties}>
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-45"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
        aria-hidden="true"
      >
        <source src={videoSource} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(3,6,10,0.88),rgba(7,10,16,0.74),rgba(8,12,18,0.9))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(102,244,255,0.12),transparent_18%),radial-gradient(circle_at_86%_15%,rgba(255,178,244,0.12),transparent_16%),radial-gradient(circle_at_50%_90%,rgba(160,188,255,0.1),transparent_26%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)] animate-pulse-line" />

      <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center">
        <div className="h-40 w-80 rounded-full bg-cyan-300/20 blur-3xl" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <div className="h-56 w-96 rounded-full bg-fuchsia-300/10 blur-3xl" />
      </div>

      <div className="pointer-events-none absolute left-8 top-8 h-24 w-24 rounded-full border border-white/15 bg-white/[0.03] animate-float" />
      <div className="pointer-events-none absolute bottom-12 right-10 h-20 w-20 rounded-[1.4rem] border border-cyan-200/20 bg-cyan-300/10 animate-float" style={{ animationDelay: "1.3s" }} />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 backdrop-blur-xl">
              <Image src={logoSource} alt="Gapak logo" width={32} height={32} className="rounded-xl" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Gapak</p>
                <p className="text-sm text-muted-foreground">{t("landing.productLine")}</p>
              </div>
            </div>

            <div className="max-w-2xl space-y-4">
              <p className="text-[11px] uppercase tracking-[0.35em] text-primary">Private social OS</p>
              <h1 className="font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
                A premium social perimeter engineered for calm confidence.
              </h1>
              <p className="max-w-xl text-base leading-8 text-muted-foreground">
                Crafted for fast, secure access with an immersive glass interface, cinematic motion, and a deep premium feel.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Live visuals</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Premium glass UI</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">Adaptive auth flow</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item.title} className="glass-surface p-4">
                  <item.icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 font-display text-lg font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2.5rem] bg-[radial-gradient(circle_at_30%_20%,rgba(102,244,255,0.18),transparent_18%),radial-gradient(circle_at_80%_80%,rgba(255,178,244,0.16),transparent_18%)] blur-2xl" />
            <div className="glass-panel relative rounded-[2.5rem] p-5 shadow-glow sm:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Access vault</p>
                  <p className="mt-2 text-sm text-muted-foreground">Cinematic sign-in experience</p>
                </div>
                {aside}
              </div>

              <div className="space-y-1">
                <h2 className="font-display text-3xl font-semibold text-white sm:text-[2rem]">{title}</h2>
                <p className="text-sm leading-7 text-muted-foreground">{description}</p>
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

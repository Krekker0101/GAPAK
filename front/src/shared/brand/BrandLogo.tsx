import React from 'react';
import logoUrl from '../../assets/brand/gapak-logo.jpg';

interface BrandLogoProps {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
}

/** Optimized application mark derived from the source artwork in assets/img. */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'h-10 w-10',
  decorative = false,
  priority = false,
}) => (
  <span
    className={`relative inline-flex shrink-0 overflow-hidden rounded-[28%] bg-[#383438] shadow-[0_8px_24px_-10px_rgb(217_70_239/.65)] ring-1 ring-white/15 ${className}`}
    role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : 'GAPAK'}
    aria-hidden={decorative || undefined}
  >
    <img
      src={logoUrl}
      alt=""
      width={256}
      height={256}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
      className="h-full w-full select-none object-cover"
    />
    <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />
  </span>
);

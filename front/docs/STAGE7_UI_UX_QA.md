# Stage 7 UI/UX QA

## Static checks completed
- Production source contains no `bg-slate-*`, `text-slate-*`, or `border-slate-*` coupling.
- Shared colors, radii, shadows, focus, motion and z-index are defined in `tokens.css`.
- Default theme is light; dark remains an explicit user option.
- Shared Dialog has Escape handling, focus capture, Tab trapping and focus restoration.
- Drawer has Escape handling, focus capture and focus restoration, with mobile safe-area support.
- Mobile navigation has 44px minimum targets and safe-area padding.
- A skip link and main-content landmark are present.
- Reduced-motion media query is global; a `useReducedMotion` hook is available for JS-driven motion.
- Routes are lazy loaded through React Suspense.
- Vite build uses esbuild minification, CSS splitting, modern target and vendor chunking.

## Required browser QA matrix
Run against a real browser with production backend data at:

| Width | Areas |
|---:|---|
| 390 | chat, stories, media, feed, profile, live, sheets |
| 430 | chat, stories, media, feed, profile, live, sheets |
| 1024 | navigation, feed, profile, dialogs, media |
| 1280 | full shell, feed, profile, media/live |
| 1440 | full shell, feed, profile, media/live |

Check: horizontal overflow, clipped dialogs, keyboard focus, focus restoration, touch target size, text wrapping, poster aspect ratios, HLS controls, bottom sheets, and notification popovers.

## Measurement limitation
This archive was produced without a working dependency install/browser runtime. `npm install` is blocked by the configured registry returning 404 for `@tailwindcss/vite@^4.1.14`. Therefore Lighthouse/Core Web Vitals and a full browser interaction pass are intentionally marked as **not verified**, rather than claimed as passing.

# GAPAK Production Design System

## Direction
Light-first, premium, calm, privacy-oriented. Glass is reserved for navigation/popovers and never used as the default surface.

## Token source of truth
`src/shared/design-system/tokens.css` owns semantic colors, spacing primitives, radii, shadows, motion, focus, and layering.

Semantic UI classes include `bg-app`, `bg-surface`, `bg-surface-muted`, `text-primary`, `text-secondary`, `text-tertiary`, `text-muted`, `border-subtle`, `border-default`, and token shadows.

## Accessibility
- Minimum interactive target: 40px in shared controls; mobile navigation uses 44px targets.
- Global `:focus-visible` indicator.
- Dialogs trap Tab, restore focus, and close on Escape.
- `prefers-reduced-motion` disables non-essential animation.
- Offline state is exposed as a polite live region.
- Main content has a skip link and focus target.

## Responsive breakpoints
The application uses Tailwind's responsive primitives with mobile-first layout. Critical QA widths: 390, 430, 1024, 1280, 1440px.

## Performance rules
- Route-level pages are lazy loaded.
- Media uses lazy loading and IntersectionObserver.
- Do not add memo/useMemo/useCallback without a measured render or computation benefit.
- Prefer cursor pagination and bounded lists over unbounded DOM growth.

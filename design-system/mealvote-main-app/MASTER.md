# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** MealVote Main App
**Generated:** 2026-04-03 12:55:10
**Category:** Restaurant/Food Service

---

## Global Rules

### Color Palette

> Warm-earth palette — chosen to evoke food, warmth, and approachability. Defined via
> HSL tokens in `apps/web/tailwind.config.ts`.

| Role | HSL | Tailwind Token |
|------|-----|----------------|
| Primary | `hsl(24 66% 34%)` | `primary` |
| Primary FG | `hsl(39 90% 97%)` | `primary-foreground` |
| Secondary | `hsl(38 29% 88%)` | `secondary` |
| Accent/CTA | `hsl(30 80% 52%)` | `accent` |
| Destructive | `hsl(0 72% 51%)` | `destructive` |
| Background | `hsl(42 36% 95%)` | `background` |
| Foreground | `hsl(24 26% 17%)` | `foreground` |
| Muted | `hsl(40 26% 90%)` | `muted` |
| Muted FG | `hsl(29 12% 38%)` | `muted-foreground` |
| Card | `hsl(39 90% 98%)` | `card` |
| Border | `hsl(40 22% 84%)` | `border` |
| Ring | `hsl(24 66% 34%)` | `ring` |

**Color Notes:** Warm earth tones match food/restaurant domain. Accent orange for CTAs. Destructive red for dangerous actions.

### Typography

- **Heading Font:** Manrope (geometric sans, `--font-heading`)
- **Body Font:** Noto Sans TC (CJK-optimised sans, `--font-body`)
- **Mood:** modern, warm, approachable, clean, dual-script (Latin + Traditional Chinese)
- **Loading:** Next.js `next/font/google` with `font-display: swap` (automatic)

> Manrope + Noto Sans TC chosen over Calistoga + Inter because the product is
> primarily zh-TW. Noto Sans TC provides native CJK support; Manrope gives
> geometric contrast for headings without clashing with CJK body text.

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons (shadcn/ui + CVA)

Defined in `apps/web/components/ui/button.tsx`. All variants share:
- `rounded-2xl` (1.75rem border-radius)
- `cursor-pointer`
- `focus-visible:ring-2 focus-visible:ring-ring`
- `disabled:opacity-50 disabled:pointer-events-none`

| Variant | Background | Text |
|---------|-----------|------|
| default (primary) | `bg-primary` | `text-primary-foreground` |
| secondary | `bg-secondary` | `text-secondary-foreground` |
| ghost | transparent | `text-foreground` |

### Cards

- `rounded-[1.5rem]` to `rounded-[1.75rem]`
- `border border-border/80`
- `bg-card/90`
- `shadow-float` for hero cards, `shadow-sm` for nested panels

### Inputs

- `rounded-2xl border border-border bg-background px-4 py-3`
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`
- Always wrapped in `<label>` or use `aria-label`

---

## Style Guidelines

**Style:** Vibrant & Block-based

**Keywords:** Bold, energetic, playful, block layout, geometric shapes, high color contrast, duotone, modern, energetic

**Best For:** Startups, creative agencies, gaming, social media, youth-focused, entertainment, consumer

**Key Effects:** Large sections (48px+ gaps), animated patterns, bold hover (color shift), scroll-snap, large type (32px+), 200-300ms

### Page Pattern

**Pattern Name:** Real-Time / Operations Landing

- **Conversion Strategy:** For ops/security/iot products. Demo or sandbox link. Trust signals.
- **CTA Placement:** Primary CTA in nav + After metrics
- **Section Order:** 1. Hero (product + live preview or status), 2. Key metrics/indicators, 3. How it works, 4. CTA (Start trial / Contact)

---

## Anti-Patterns (Do NOT Use)

- ❌ Low-quality imagery
- ❌ Outdated hours

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

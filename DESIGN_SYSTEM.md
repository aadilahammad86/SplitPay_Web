# SplitPay Web — Design System Record

## Tokens

### Surfaces & Borders (`src/ui/theme.ts:218-269`, `src/index.css:8-16`)
| Token Name | CSS Variable | Light Theme | Dark Theme | AMOLED Theme |
| :--- | :--- | :--- | :--- | :--- |
| Background | `--color-bg` | `#f8fafc` | `#090d16` | `#000000` |
| Surface | `--color-surface` | `#ffffff` | `#131b2e` | `#0a0a0a` |
| Surface Subtle | `--color-surface-subtle` | `#f1f5f9` | `#1e293b` | `#141414` |
| Surface Elevated | `--color-surface-elevated` | `#ffffff` | `#1a243a` | `#171717` |
| Border | `--color-border` | `#e2e8f0` | `#2a3754` | `#262626` |
| Border Subtle | `--color-border-subtle` | `#cbd5e1` | `#1e293b` | `#1a1a1a` |

### Text Levels & Semantics (`src/ui/theme.ts:225-257`)
| Token | CSS Variable | Light | Dark / AMOLED | Usage |
| :--- | :--- | :--- | :--- | :--- |
| Text Primary | `--color-text` | `#0f172a` | `#f8fafc` | Primary headings, body copy |
| Text Muted | `--color-text-muted` | `#475569` | `#94a3b8` | Subtitles, labels, secondary info |
| Text Subtle | `--color-text-subtle` | `#94a3b8` | `#64748b` | Disabled states, placeholders |
| Positive (Credit) | `--color-positive` | `#10b981` | `#34d399` | "You are owed" amounts, paid status |
| Positive Bg | `--color-positive-bg` | `#ecfdf5` | `#064e3b33` | Credit chips, sync OK banners |
| Negative (Debt) | `--color-negative` | `#f43f5e` | `#fb7185` | "You owe" amounts, error states |
| Negative Bg | `--color-negative-bg` | `#fff1f2` | `#88133733` | Debt chips, sync error alerts |
| Warning | `--color-warning` | `#f59e0b` | `#fbbf24` | Pending sync outbox count |

### Accent Palettes (`src/ui/theme.ts:26-195`)
| Palette ID | Name | Swatch | Light Primary / Hover | Dark Primary / Hover | Light / Dark Subtle |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `emerald` (default)| Split Emerald | `#10b981` | `#059669` / `#047857` | `#10b981` / `#34d399` | `#ecfdf5` / `rgba(16,185,129,0.15)` |
| `ocean` | Ocean Blue | `#3b82f6` | `#2563eb` / `#1d4ed8` | `#3b82f6` / `#60a5fa` | `#eff6ff` / `rgba(59,130,246,0.15)` |
| `indigo` | Royal Violet | `#6366f1` | `#4f46e5` / `#4338ca` | `#6366f1` / `#818cf8` | `#eef2ff` / `rgba(99,102,241,0.15)` |
| `amber` | Sunset Amber | `#f59e0b` | `#d97706` / `#b45309` | `#f59e0b` / `#fbbf24` | `#fffbeb` / `rgba(245,158,11,0.15)` |
| `rose` | Berry Rose | `#f43f5e` | `#e11d48` / `#be123c` | `#f43f5e` / `#fb7185` | `#fff1f2` / `rgba(244,63,94,0.15)` |
| `slate` | Nordic Slate | `#64748b` | `#334155` / `#1e293b` | `#94a3b8` / `#cbd5e1` | `#f1f5f9` / `rgba(148,163,184,0.15)` |

### Typography (`src/index.css:4-5`, Tailwind scale)
- **Families**: `--sans`: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`; `--mono`: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.
- **Scale**: `text-[10px]` (status/pills), `text-[11px]` (subtitles/dates), `text-xs` (12px, default body), `text-sm` (14px, inputs/modals), `text-base` (16px, headings), `text-xl` (20px, titles), `text-2xl` / `text-3xl` / `text-4xl` (metrics).
- **Weights**: `font-medium` (500), `font-semibold` (600), `font-bold` (700), `font-extrabold` (800).

### Radii, Shadows & Z-Index
- **Radii**: `rounded-lg` (8px, small icon buttons), `rounded-xl` (12px, canonical button/input/row), `rounded-2xl` (16px, containers/menus), `rounded-3xl` (24px, cards/modals), `rounded-full` (pills/avatars).
- **Shadows**: `shadow-sm` (cards/inputs), `shadow-md` (primary buttons), `shadow-xl` (hero card), `shadow-2xl` (modal/dropdowns).
- **Z-Index**: `z-10` (card elements), `z-40` (sticky Navbar, fixed BottomNav), `z-50` (Modal backdrop & dialog, Select menu, Toast).

## Theming Mechanism
- **Provider**: `src/ui/themeContext.tsx:ThemeProvider` wraps the app tree.
- **Modes**: `system`, `light`, `dark`, `amoled`. Persisted in `localStorage.getItem('splitpay_theme_mode')`.
- **Palettes**: 6 accent presets (`emerald`, `ocean`, `indigo`, `amber`, `rose`, `slate`). Persisted in `localStorage.getItem('splitpay_color_palette')`.
- **Application**: Injects CSS variables onto `document.documentElement` (`--color-bg`, `--color-surface`, `--color-primary`, etc.) and adds/removes `.dark` class (`src/ui/themeContext.tsx:82-112`). Light mode exists and is fully functional.

## Component Patterns

### Buttons
- **Primary Action**: `px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95` (`src/features/dashboard/DashboardView.tsx:128`)
- **Secondary / Outline**: `px-4 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] text-[var(--color-text)] border border-[var(--color-border)] font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95` (`src/features/dashboard/DashboardView.tsx:140`)
- **Danger / Delete**: `px-3.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl transition-colors inline-flex items-center gap-1.5 active:scale-95 cursor-pointer` (`src/features/groups/GroupsView.tsx:515`)
- **Icon Action**: `p-1.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] text-sm transition-colors` (`src/ui/components/Navbar.tsx:103`)

### Cards
- **Standard Surface**: `bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-5 sm:p-6 shadow-sm` (`src/features/dashboard/DashboardView.tsx:273`)
- **Hover Metric**: `bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm card-hover flex flex-col justify-between` (`src/features/dashboard/DashboardView.tsx:198`)
- **Hero Gradient**: `hero-gradient rounded-3xl p-6 text-white shadow-xl relative overflow-hidden card-hover sm:col-span-2 lg:col-span-1` (`src/features/dashboard/DashboardView.tsx:151`)

### List Rows
- **Transaction Item**: `py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--color-surface-subtle)] -mx-2 px-2 rounded-xl transition-colors` (`src/features/dashboard/DashboardView.tsx:312`)
- **Row Icon Avatar**: `w-10 h-10 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-primary shrink-0` (`src/features/dashboard/DashboardView.tsx:315`)

### Badges & Chips
- **Positive / Credit Pill**: `text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full` (`src/features/dashboard/DashboardView.tsx:261`)
- **Primary / PWA Tag**: `text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-subtle text-primary border border-primary-border` (`src/ui/components/Sidebar.tsx:87`)
- **Counter Badge**: `text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white` (`src/ui/components/Sidebar.tsx:212`)

### Inputs & Selects
- **Text Input**: `flex-1 px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary` (`src/features/expense/ExpenseEditorModal.tsx:315`)
- **Custom Dropdown Trigger**: `w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)]/20 border border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl font-bold text-xs sm:text-sm text-[var(--color-text)] flex items-center justify-between gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed` (`src/ui/components/Select.tsx:94`)
- **Select Floating Menu**: `absolute left-0 w-full min-w-[10rem] z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl py-1.5 max-h-56 overflow-y-auto overscroll-contain animate-modal-pop` (`src/ui/components/Select.tsx:116`)

### Nav Items
- **Sidebar Active**: `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all bg-primary text-white shadow-sm` (`src/ui/components/Sidebar.tsx:156`)
- **Sidebar Inactive**: `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]` (`src/ui/components/Sidebar.tsx:159`)
- **Mobile Bottom Nav**: `flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl transition-all relative` (`src/ui/components/BottomNav.tsx:29`)

## Layout Patterns
- **Page Shell**: Root container is `flex min-h-screen bg-[var(--color-bg)] transition-colors duration-200` (`src/App.tsx:209`).
- **Sidebar Navigation**: Desktop fixed drawer `hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-md sticky top-0 h-screen p-5 justify-between select-none` (`src/ui/components/Sidebar.tsx:72`).
- **View Container**: `flex-1 w-full max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 pb-32 md:pb-10` (`src/App.tsx:224`).
- **Breakpoints**: `<768px` (`md:`): Sidebar hidden, `Navbar` (top) and `BottomNav` (bottom dock) visible, `pb-32` bottom clearance. `>=768px`: Desktop sidebar visible, mobile navbars hidden. Grid splits use `lg:grid-cols-12` (7 col / 5 col).
- **Safe Areas**: `.safe-top` (`padding-top: max(0.75rem, env(safe-area-inset-top))`) and `.safe-bottom` (`padding-bottom: max(0.5rem, env(safe-area-inset-bottom))`) (`src/index.css:68-73`).

## Money Display
- **Component**: `src/ui/components/MoneyDisplay.tsx:MoneyDisplay`.
- **Integer Minor Units**: Inputs are strictly minor integers (`safeMinor = Number.isInteger(minor) ? minor : 0`). Decimal conversion is `minor / currency.scale`.
- **Currency Symbols**: INR `₹`, AED `AED`, USD `$`, EUR `€`, GBP `£`, JPY `¥`, KWD `KD` (`src/domain/money.ts:Currencies`).
- **Formatting**: `money.plain()` (always fixed decimal places: 2 for INR/AED, 0 for JPY, 3 for KWD).
- **Signs & Color**:
  - Positive (> 0): Prepend `+`, intended color `text-positive` (see Inconsistencies).
  - Negative (< 0): Prepend `-`, intended color `text-negative`.
  - Zero / Settled: No sign, intended color `text-muted`.
- **Spoken Text**: Screen readers receive `aria-label="positive 500.00 INR"` via `money.spoken()`.

## Motion Today
| Animation / Transition | Duration | Easing | Source |
| :--- | :--- | :--- | :--- |
| `.animate-fade-in` | `0.2s` | `cubic-bezier(0.16, 1, 0.3, 1)` | `src/index.css:184-186` |
| `.animate-slide-up` | `0.25s` | `cubic-bezier(0.16, 1, 0.3, 1)` | `src/index.css:188-190` |
| `.animate-modal-backdrop` | `0.2s` | `cubic-bezier(0.16, 1, 0.3, 1)` | `src/index.css:192-194` |
| `.animate-modal-pop` | `0.25s` | `cubic-bezier(0.16, 1, 0.3, 1)` | `src/index.css:196-198` |
| `.animate-pulse-subtle` | `3s` (infinite) | `ease-in-out` | `src/index.css:200-202` |
| `.card-hover` | `0.2s` | `cubic-bezier(0.16, 1, 0.3, 1)` | `src/index.css:205-211` |
| `.hero-gradient` icon hover | `0.2s` | `transition-transform group-hover:scale-105` | `src/ui/components/Sidebar.tsx:79` |
| Button click feedback | Instant | `active:scale-95` / `active:scale-98` | Multiple components |
| Sync spinning indicator | `1s` (infinite) | `animate-spin` | `src/ui/components/Navbar.tsx:88` |
- **Prefers-Reduced-Motion**: Enforced globally in `src/index.css:58-65` via `@media (prefers-reduced-motion: reduce)` setting `animation-duration: 0.001ms !important`, `transition-duration: 0.001ms !important`, and `scroll-behavior: auto !important`.

## Icons & Assets
- **Library**: Custom inlined SVG sprite dictionary using Majesticons path geometry (`src/ui/components/Icon.tsx`).
- **Base Attributes**: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, default `strokeWidth={2}`.
- **Sizing Conventions**:
  - `size={12}` to `size={15}`: In-badge indicators, status icons, micro controls.
  - `size={16}` to `size={18}`: Button icons, form field adornments, navigation links.
  - `size={20}` to `size={24}`: Category avatars, header logos, primary card icons.
  - `size={32}` to `size={40}`: Empty-state illustrations, error headers.
- **Category Mapper**: `CategoryIcon` (`src/ui/components/Icon.tsx:224`) maps emoji strings (`🍔`, `☕`, `✈️`, `🏝`, etc.) to matching SVG `IconName`.

## Inconsistencies
1. **Missing CSS Utility Classes**: `src/ui/components/MoneyDisplay.tsx:29-31` assigns classes `text-positive`, `text-negative`, and `text-muted`, but these classes are never declared in `src/index.css`. As a result, standalone `MoneyDisplay` renders uncolored text unless wrapped in color-specifying elements.
2. **Hardcoded Semantic Colors**: To work around missing semantic classes, components hardcode Tailwind palette classes: `text-emerald-600 dark:text-emerald-400` / `bg-emerald-50 dark:bg-emerald-950/40` and `text-rose-600 dark:text-rose-400` / `bg-rose-50 dark:bg-rose-950/40` across `DashboardView.tsx`, `FriendsView.tsx`, `GroupsView.tsx`, and `StatementsView.tsx`.
3. **Hardcoded Accent Colors on Inputs**: `src/features/expense/ExpenseEditorModal.tsx:346` uses `text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500` and `src/features/settle/SettleUpModal.tsx:176` uses `text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500`, ignoring the user's active theme palette tokens (`text-primary`, `focus:ring-primary`).
4. **Card Radius Variance**: Metric and activity cards use `rounded-3xl` (`DashboardView.tsx:151,198`), dialog modals use `rounded-2xl sm:rounded-3xl` (`Modal.tsx:69`), while profile containers use `rounded-2xl` (`Sidebar.tsx:98`).
5. **Dead / Orphan Stylesheet**: `src/App.css` (185 lines) contains unused Vite scaffold rules (`.counter`, `.hero`, `#next-steps`) and is not imported by `src/main.tsx` or any active component.

## Accessibility Status
- **Color Contrast**:
  - Primary text (`#0f172a` on `#ffffff`) and muted text (`#475569` on `#ffffff`) achieve >5:1 contrast, exceeding WCAG AA requirements.
  - Status badge in `Sidebar.tsx:212` (`bg-amber-500 text-white`) has a contrast ratio of ~2.1:1, failing WCAG AA (4.5:1 minimum).
  - Heavy reliance on `text-[10px]` and `text-[11px]` creates legibility challenges on low-DPI displays.
- **Focus Rings**:
  - Global inputs/selects use `focus:border-primary` with `box-shadow: 0 0 0 3px var(--color-primary-glow)` (`src/index.css:83-87`). Custom select uses `focus:ring-2 focus:ring-primary/20` (`Select.tsx:94`).
- **Touch Targets**:
  - Primary buttons (`py-2.5 px-4` ~40px) and bottom nav items meet touch target guidelines.
  - Sidebar utility buttons (`Sidebar.tsx:116,128`: `p-1.5` with `size={15}`) measure ~28x28px, below the recommended 44x44px minimum touch target for mobile devices.

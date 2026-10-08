# ADR 0004: Progressive Web App and Cross-Platform Distribution

- Status: Accepted
- Date: 2026-10-08

## Context

The product requires broad multi-platform accessibility across Windows, macOS, Android, and iOS (iPhone) browsers without requiring an Apple Developer Program membership ($99/year) or a physical Mac build environment. The application must install cleanly to device home screens/desktops and operate reliably with or without an active internet connection.

## Decision

1. **Progressive Web App Architecture**:
   - Provide a valid `manifest.webmanifest` defining `standalone` display mode, name, theme colors (`#0f172a` / `#ffffff`), background color, and icons (SVG and PNG formats).
   - Implement a Service Worker (`sw.js`) utilizing cache-first strategies for immutable static assets (JavaScript, CSS, fonts, SVG icons) and network-first / cache-fallback for the root application shell.
2. **Platform-Specific Installation UX**:
   - Chromium / Android / Windows / Edge: Listen for `beforeinstallprompt`, hold the event, and display a prominent "Install App" button in navigation/settings.
   - iOS Safari: Because WebKit does not emit `beforeinstallprompt`, detect iOS Safari and provide an accessible guided modal illustrating the two-step action: "Tap Share icon [↑] then 'Add to Home Screen' [+]".
   - macOS Safari: Guide users to "File > Add to Dock" or PWA installation.
3. **Responsive and Accessible Design System**:
   - Mobile-first responsive layout: Bottom navigation bar on mobile viewports (<768px), adaptive sidebar/header on desktop/tablet viewports.
   - Respect viewport safe area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) for notch and home bar handling on iOS.
   - Support dark mode, light mode, and high-contrast AMOLED mode.
   - Strictly honor `@media (prefers-reduced-motion: reduce)` by bypassing spring animations and using subtle opacity crossfades.
4. **Offline and Network Status Visibility**:
   - Monitor `navigator.onLine` and `window.addEventListener('online' / 'offline')`.
   - Prominently display online status, pending outbox sync badge, and explicit manual "Sync Now" action.

## Consequences

- Zero App Store fees or approval bottlenecks.
- Single unified codebase serving desktop and mobile operating systems.
- Immediate updates delivered via standard web cache invalidation.

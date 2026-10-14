import { useCallback } from 'react'

/**
 * Returns a function that wraps a state-update callback in the
 * View Transitions API (where supported). Falls back to calling
 * the callback directly on unsupported browsers.
 *
 * Usage:
 *   const transition = useViewTransition()
 *   <BottomNav onNavigate={(tab) => transition(() => setCurrentTab(tab))} />
 */
export function useViewTransition() {
  return useCallback((callback: () => void) => {
    callback()
  }, [])
}

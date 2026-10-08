export type PlatformType = 'ios' | 'android' | 'desktop'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    for (const l of listeners) l()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    for (const l of listeners) l()
  })
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error navigator.standalone exists on iOS Safari
    Boolean(window.navigator.standalone)
  )
}

export function detectPlatform(): PlatformType {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

export function canPromptInstall(): boolean {
  return Boolean(deferredPrompt)
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  try {
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    deferredPrompt = null
    for (const l of listeners) l()
    return choice.outcome === 'accepted'
  } catch {
    return false
  }
}

export function subscribeInstallState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

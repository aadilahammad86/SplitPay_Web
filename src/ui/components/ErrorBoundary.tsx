import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SplitPay Uncaught ErrorBoundary Exception:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleClearCacheAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const reg of registrations) {
          await reg.unregister()
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        for (const key of keys) {
          await caches.delete(key)
        }
      }
    } catch (e) {
      console.warn('Error clearing cache:', e)
    } finally {
      window.location.href = window.location.origin + window.location.pathname + '?nocache=' + Date.now()
    }
  }

  private handleResetAll = async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Are you sure you want to reset local storage? This will clear locally cached data.'
      )
    ) {
      return
    }

    try {
      localStorage.clear()
      sessionStorage.clear()
      if ('indexedDB' in window) {
        window.indexedDB.deleteDatabase('splitpay_db')
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const reg of registrations) {
          await reg.unregister()
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        for (const key of keys) {
          await caches.delete(key)
        }
      }
    } catch (e) {
      console.warn('Error resetting storage:', e)
    } finally {
      window.location.href = window.location.origin + window.location.pathname
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--color-bg)] text-[var(--color-text)]">
          <div className="w-full max-w-lg p-6 sm:p-8 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-2xl space-y-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto text-3xl shadow-sm">
              <Icon name="alert" size={32} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Something went wrong
              </h1>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                SplitPay encountered an unexpected interface error. Your offline data is safe.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl p-3 text-xs font-mono text-rose-500 overflow-x-auto max-h-36">
                <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-[var(--color-text-muted)] mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-2xl shadow-md transition-all active:scale-95 inline-flex items-center justify-center gap-2"
              >
                <Icon name="reload" size={15} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="flex-1 py-3 px-4 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-2xl transition-colors inline-flex items-center justify-center gap-2"
              >
                <Icon name="delete" size={15} />
                <span>Clear Cache & Reload</span>
              </button>
            </div>

            <div className="pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={this.handleResetAll}
                className="text-[11px] text-[var(--color-text-muted)] hover:text-rose-500 font-medium underline transition-colors"
              >
                Reset local database & start fresh
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

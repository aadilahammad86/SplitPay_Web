import React, { useEffect, useState } from 'react'
import {
  defaultNotificationService,
  type InAppToast,
} from '../../services/notifications/notificationService'
import { Icon } from './Icon'

export const NotificationToast: React.FC = () => {
  const [toasts, setToasts] = useState<InAppToast[]>([])

  useEffect(() => {
    return defaultNotificationService.subscribeToast((newToast) => {
      setToasts((prev) => [...prev.slice(-4), newToast]) // keep max 5 recent

      // Auto dismiss after 4.5s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id))
      }, 4500)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success'
        const isWarning = toast.type === 'warning'

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-2xl shadow-xl border flex items-start gap-3 backdrop-blur-md transition-all animate-slide-up ${
              isSuccess
                ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                : isWarning
                ? 'bg-amber-50/95 dark:bg-amber-950/90 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100'
                : 'bg-[var(--color-surface)]/95 border-[var(--color-border)] text-[var(--color-text)]'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                isSuccess
                  ? 'bg-emerald-500 text-white'
                  : isWarning
                  ? 'bg-amber-500 text-white'
                  : 'bg-primary text-white'
              }`}
            >
              <Icon
                name={isSuccess ? 'check' : isWarning ? 'alert' : 'bell'}
                size={16}
              />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <h5 className="font-extrabold text-xs tracking-tight truncate">
                {toast.title}
              </h5>
              {toast.body && (
                <p className="text-[11px] opacity-90 mt-0.5 leading-snug break-words">
                  {toast.body}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="p-1 rounded-lg text-current opacity-60 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

import React from 'react'
import { Modal } from '../ui/components/Modal'
import { detectPlatform, canPromptInstall, promptInstall } from './pwaManager'
import { Icon } from '../ui/components/Icon'

interface InstallModalProps {
  isOpen: boolean
  onClose: () => void
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose }) => {
  const platform = detectPlatform()
  const canPrompt = canPromptInstall()

  const handleInstallClick = async () => {
    const installed = await promptInstall()
    if (installed) {
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Icon name="smartphone" size={20} className="text-primary" />
          <span>Install SplitPay</span>
        </span>
      }
    >
      <div className="space-y-5 text-sm text-[var(--color-text)]">
        <div className="flex items-center gap-3 p-3 bg-[var(--color-surface-subtle)] rounded-xl border border-[var(--color-border)]">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white text-2xl font-bold shadow-md">
            <Icon name="rupee" size={26} />
          </div>
          <div>
            <h3 className="font-bold text-base">SplitPay PWA</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Fast, offline-ready, and works on all devices without an app store.
            </p>
          </div>
        </div>

        {canPrompt ? (
          <div className="space-y-3">
            <p className="text-[var(--color-text-muted)]">
              Your browser supports one-tap installation. Install SplitPay to your home screen or desktop for an app-like experience.
            </p>
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Icon name="smartphone" size={18} />
              <span>Install App</span>
            </button>
          </div>
        ) : platform === 'ios' ? (
          <div className="space-y-4">
            <p className="font-medium">To install on iPhone or iPad (Safari):</p>
            <ol className="space-y-2.5 list-decimal list-inside text-[var(--color-text-muted)]">
              <li>
                Tap the <strong className="text-[var(--color-text)]">Share</strong> icon{' '}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border)] align-middle">
                  <Icon name="share" size={13} />
                </span>{' '}
                in the bottom bar of Safari.
              </li>
              <li>
                Scroll down in the share sheet and tap{' '}
                <strong className="text-[var(--color-text)]">Add to Home Screen</strong>{' '}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border)] align-middle">
                  <Icon name="plus" size={13} />
                </span>.
              </li>
              <li>
                Tap <strong className="text-[var(--color-text)]">Add</strong> in the top right corner.
              </li>
            </ol>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
              <Icon name="info" size={16} className="shrink-0 mt-0.5" />
              <span>Note: Apple requires Safari for installation. If you are using Chrome or Firefox on iOS, open this link in Safari first.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-[var(--color-text-muted)]">
            <p>To install on your browser:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong>Chrome / Edge (Desktop):</strong> Click the install icon in the right side of the address bar, or open the menu [⋮] and click <em>Install SplitPay</em>.
              </li>
              <li>
                <strong>Mac (Safari):</strong> Choose <em>File</em> in the menu bar and click <em>Add to Dock</em>.
              </li>
              <li>
                <strong>Android:</strong> Tap the browser menu [⋮] and select <em>Add to Home screen</em> or <em>Install app</em>.
              </li>
            </ul>
          </div>
        )}

        <div className="pt-2 border-t border-[var(--color-border)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] rounded-xl font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </Modal>
  )
}

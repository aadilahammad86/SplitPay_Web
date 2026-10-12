import React, { useState } from 'react'
import { Modal } from '../../ui/components/Modal'
import { Icon } from '../../ui/components/Icon'
import { useStore } from '../../ui/storeContext'

interface SyncStatusModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SyncStatusModal: React.FC<SyncStatusModalProps> = ({ isOpen, onClose }) => {
  const { store, syncEngine, syncState, ledgerState, sharedLedgerId } = useStore()
  const [syncingNow, setSyncingNow] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const isSyncing = syncState?.status === 'syncing' || syncingNow
  const isOffline = syncState?.status === 'offline' || !syncState?.isOnline
  const isError = syncState?.status === 'error'
  const pendingCount = ledgerState.pendingOpsCount

  const handleManualSync = async () => {
    setFeedback(null)
    setSyncingNow(true)
    try {
      if (syncEngine) {
        await syncEngine.syncNow()
        await store.syncMyProfileToCloud()
        setFeedback('Sync completed! Ledger operations reconciled.')
      } else {
        await store.syncMyProfileToCloud()
        setFeedback('Profile pushed to cloud database.')
      }
    } catch (err) {
      setFeedback(`Sync failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSyncingNow(false)
    }
  }

  const handleForceClear = async () => {
    setClearing(true)
    setFeedback(null)
    try {
      await store.forceClearOutbox()
      setFeedback('Outbox queue cleared.')
    } catch (err) {
      setFeedback(`Clear failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setClearing(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cloud Sync & Outbox Status">
      <div className="space-y-4 text-sm py-1 animate-fade-in">
        {/* Status Banner */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            isSyncing
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              : isError
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : pendingCount > 0
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-black/20 flex items-center justify-center shrink-0">
              <Icon
                name={isSyncing ? 'reload' : isError ? 'close' : pendingCount > 0 ? 'reload' : 'check'}
                size={20}
                className={isSyncing ? 'animate-spin' : ''}
              />
            </div>
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider">
                {isSyncing
                  ? 'Syncing in Progress'
                  : isError
                  ? 'Sync Notice'
                  : isOffline
                  ? 'Local Storage Mode'
                  : pendingCount > 0
                  ? 'Changes Pending Upload'
                  : 'All Changes Synced'}
              </h4>
              <p className="text-xs opacity-90 font-medium mt-0.5">
                {isSyncing
                  ? 'Exchanging operations with Supabase...'
                  : isError
                  ? syncState?.error || 'Unable to sync with remote server'
                  : pendingCount > 0
                  ? `${pendingCount} operation(s) safely saved locally in outbox`
                  : 'Device is fully in sync with shared ledger'}
              </p>
            </div>
          </div>

          {pendingCount > 0 && (
            <span className="px-2.5 py-1 bg-amber-500 text-white font-extrabold text-xs rounded-full shrink-0 shadow-sm">
              {pendingCount}
            </span>
          )}
        </div>

        {/* Sync Info Grid */}
        <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-2.5 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-[var(--color-border)]">
            <span className="text-[var(--color-text-muted)] font-medium">Shared Ledger ID</span>
            <span className="font-mono font-bold text-[var(--color-text)]">
              {sharedLedgerId || 'default_ledger'}
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-[var(--color-border)]">
            <span className="text-[var(--color-text-muted)] font-medium">Cloud Backend</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Supabase Connected</span>
            </span>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-[var(--color-border)]">
            <span className="text-[var(--color-text-muted)] font-medium">Pending Outbox</span>
            <span className="font-mono font-bold text-[var(--color-text)]">
              {pendingCount} operation(s)
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-[var(--color-text-muted)] font-medium">Last Cloud Sync</span>
            <span className="font-medium text-[var(--color-text)]">
              {syncState?.lastSyncedAt
                ? new Date(syncState.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : 'Initial session'}
            </span>
          </div>
        </div>

        {feedback && (
          <div className="p-3 bg-primary-subtle border border-primary-border text-primary text-xs font-semibold rounded-xl animate-fade-in flex items-center gap-2">
            <Icon name="check" size={14} />
            <span>{feedback}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleManualSync}
            className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center justify-center gap-1.5"
          >
            <Icon name="reload" size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          {pendingCount > 0 && (
            <button
              type="button"
              disabled={clearing}
              onClick={handleForceClear}
              className="py-2.5 px-4 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs font-semibold rounded-xl transition-all inline-flex items-center justify-center gap-1.5"
              title="Clear pending counter if server already confirmed records"
            >
              <span>Clear Counter</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}

import React, { useState } from 'react'
import { Modal } from '../../ui/components/Modal'
import { useStore } from '../../ui/storeContext'
import type { Person } from '../../domain/entities'
import { Icon } from '../../ui/components/Icon'

interface EditFriendModalProps {
  isOpen: boolean
  onClose: () => void
  friend: Person | null
}

const EditFriendForm: React.FC<{ friend: Person; onClose: () => void }> = ({ friend, onClose }) => {
  const { store } = useStore()
  const [name, setName] = useState(friend.name)
  const [handle, setHandle] = useState(friend.handle || '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a valid name.')
      return
    }

    try {
      setIsSaving(true)
      setError(null)
      await store.updatePerson(friend.id, {
        name: name.trim(),
        handle: handle.trim() ? handle.trim().replace(/^@/, '') : undefined,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to remove ${friend.name} from your friends list?`)) {
      try {
        setIsSaving(true)
        await store.removeFriend(friend.id)
        onClose()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
        setIsSaving(false)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
          Display Name
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Maya Chen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium text-sm text-[var(--color-text)] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
          Username / Handle (Optional)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-2.5 text-[var(--color-text-muted)] font-mono text-sm">
            @
          </span>
          <input
            type="text"
            placeholder="mayachen"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="w-full pl-8 pr-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-mono text-sm text-[var(--color-text)] focus:outline-none"
          />
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
          Unique handle used to mention or recognize this friend across shared ledgers.
        </p>
      </div>

      <div className="p-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-[11px] text-[var(--color-text-muted)] flex items-center justify-between">
        <span>Ledger Member ID:</span>
        <code className="font-mono text-[var(--color-text)]">{friend.id.slice(0, 12)}...</code>
      </div>

      <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSaving}
          className="px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl transition-colors inline-flex items-center gap-1.5 active:scale-95"
        >
          <Icon name="delete" size={14} />
          <span>Remove Friend</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  )
}

export const EditFriendModal: React.FC<EditFriendModalProps> = ({ isOpen, onClose, friend }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Friend Profile">
      {friend ? <EditFriendForm key={friend.id} friend={friend} onClose={onClose} /> : null}
    </Modal>
  )
}

import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { Modal } from '../../ui/components/Modal'
import { Select } from '../../ui/components/Select'
import { type GroupKind, GroupKindInfo } from '../../domain/entities'
import { Currencies, type CurrencyCode, SupportedCurrencies } from '../../domain/money'
import { Icon } from '../../ui/components/Icon'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (groupId: string) => void
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''

  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupKind, setNewGroupKind] = useState<GroupKind>('trip')
  const [newGroupCurrency, setNewGroupCurrency] = useState<CurrencyCode>(Currencies.INR)
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([meId])

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroupName.trim()) return

    const members = newGroupMembers.includes(meId) ? newGroupMembers : [meId, ...newGroupMembers]

    const group = await store.createGroup({
      name: newGroupName.trim(),
      kind: newGroupKind,
      memberIds: members,
      currency: newGroupCurrency,
    })

    setNewGroupName('')
    setNewGroupMembers([meId])
    onClose()
    if (onCreated && group?.id) {
      onCreated(group.id)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create a Group">
      <form onSubmit={handleCreateGroup} className="space-y-4 text-sm">
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            Group Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Goa Trip 2026, Flat 402, Dinner Club"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 text-[var(--color-text)]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Kind
            </label>
            <Select
              value={newGroupKind}
              onChange={(val) => setNewGroupKind(val as GroupKind)}
              options={(Object.keys(GroupKindInfo) as GroupKind[]).map((k) => ({
                value: k,
                label: `${GroupKindInfo[k].emoji} ${GroupKindInfo[k].label}`,
              }))}
              ariaLabel="Group Kind"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Currency
            </label>
            <Select
              value={newGroupCurrency.code}
              onChange={(val) => {
                const found = SupportedCurrencies.find((c) => c.code === val)
                if (found) setNewGroupCurrency(found)
              }}
              options={SupportedCurrencies.map((c) => ({
                value: c.code,
                label: `${c.code} (${c.symbol})`,
              }))}
              ariaLabel="Group Currency"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
            Select Initial Members
          </label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl">
            {ledgerState.people.map((p) => {
              const checked = newGroupMembers.includes(p.id)
              return (
                <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--color-surface)] cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      if (checked) setNewGroupMembers(newGroupMembers.filter((m) => m !== p.id))
                      else setNewGroupMembers([...newGroupMembers, p.id])
                    }}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span className="font-semibold text-[var(--color-text)]">
                    {p.id === meId ? 'You' : p.name}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md transition-all inline-flex items-center gap-1.5"
          >
            <Icon name="check" size={14} />
            <span>Create Group</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

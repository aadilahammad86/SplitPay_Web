import React, { useState, useMemo } from 'react'
import { Modal } from '../../ui/components/Modal'
import { Select } from '../../ui/components/Select'
import { useStore } from '../../ui/storeContext'
import {
  Currencies,
  type CurrencyCode,
  SupportedCurrencies,
  Money,
} from '../../domain/money'
import {
  type Expense,
  type Person,
} from '../../domain/entities'
import { Icon } from '../../ui/components/Icon'
import { isFriendOfUser } from '../../domain/privacy'

interface ExpenseEditorModalProps {
  isOpen: boolean
  onClose: () => void
  initialGroupId?: string | null
  initialFriendId?: string | null
  expenseToEdit?: Expense | null
}

const CATEGORIES = [
  { key: '🧾', label: 'Bill / Receipt' },
  { key: '🍔', label: 'Food / Dining' },
  { key: '☕', label: 'Coffee / Drinks' },
  { key: '🛒', label: 'Groceries' },
  { key: '✈️', label: 'Travel' },
  { key: '🏨', label: 'Lodging' },
  { key: '🚕', label: 'Transport' },
  { key: '🍿', label: 'Entertainment' },
  { key: '🏠', label: 'Rent / Home' },
  { key: '🎁', label: 'Shopping' },
  { key: '⚡', label: 'Utilities' },
  { key: '🍻', label: 'Social' },
]

function formatDateToIso(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface ExpenseEditorFormProps {
  onClose: () => void
  initialGroupId?: string | null
  initialFriendId?: string | null
  expenseToEdit?: Expense | null
}

const ExpenseEditorForm: React.FC<ExpenseEditorFormProps> = ({
  onClose,
  initialGroupId = null,
  initialFriendId = null,
  expenseToEdit = null,
}) => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = ledgerState.localPersonId || me?.id || ''

  const [description, setDescription] = useState(() => expenseToEdit?.description || '')
  const [amountStr, setAmountStr] = useState(() =>
    expenseToEdit
      ? (expenseToEdit.totalMinor / expenseToEdit.currency.scale).toString()
      : ''
  )
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    if (expenseToEdit) return expenseToEdit.currency
    if (initialGroupId) {
      const g = ledgerState.groups.find((grp) => grp.id === initialGroupId)
      if (g) return g.currency
    }
    return ledgerState.defaultCurrency || Currencies.INR
  })
  const [expenseDate, setExpenseDate] = useState<string>(() => {
    if (expenseToEdit) {
      return formatDateToIso(new Date(Math.floor(expenseToEdit.createdAtMicros / 1000)))
    }
    return formatDateToIso(new Date())
  })
  const [paidBy, setPaidBy] = useState<string>(() => expenseToEdit?.paidBy || meId)
  const [groupId, setGroupId] = useState<string | null>(
    () => expenseToEdit?.groupId ?? initialGroupId
  )
  // Only 2 split modes: 'equal' or 'exact'
  const [mode, setMode] = useState<'equal' | 'exact'>(() =>
    expenseToEdit?.mode === 'exact' ? 'exact' : 'equal'
  )
  const [categoryEmoji, setCategoryEmoji] = useState(
    () => expenseToEdit?.categoryEmoji || '🧾'
  )
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  // Candidate people scoped strictly by group selection
  const candidatePeople: readonly Person[] = useMemo(() => {
    if (!groupId) {
      const friends = ledgerState.people.filter((p) =>
        isFriendOfUser({
          person: p,
          meId,
          expenses: ledgerState.expenses,
          settlements: ledgerState.settlements,
          groups: ledgerState.groups,
          isMe: (id) => store.isMe(id),
        })
      )
      return me ? [me, ...friends] : friends
    }
    const grp = ledgerState.groups.find((g) => g.id === groupId)
    if (!grp) {
      const friends = ledgerState.people.filter((p) =>
        isFriendOfUser({
          person: p,
          meId,
          expenses: ledgerState.expenses,
          settlements: ledgerState.settlements,
          groups: ledgerState.groups,
          isMe: (id) => store.isMe(id),
        })
      )
      return me ? [me, ...friends] : friends
    }
    return ledgerState.people.filter(
      (p: Person) => grp.memberIds.includes(p.id) && !p.isTombstone
    )
  }, [groupId, ledgerState.groups, ledgerState.people, ledgerState.expenses, ledgerState.settlements, meId, me, store])

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => {
    if (expenseToEdit) {
      const debtorIds = expenseToEdit.shares.map((s) => s.owedBy)
      const sumOwed = expenseToEdit.shares.reduce((acc, s) => acc + s.amountMinor, 0)
      if (sumOwed < expenseToEdit.totalMinor) {
        return Array.from(new Set([expenseToEdit.paidBy, ...debtorIds]))
      }
      return debtorIds.length > 0 ? debtorIds : [expenseToEdit.paidBy]
    }
    if (initialGroupId) {
      const group = ledgerState.groups.find((g) => g.id === initialGroupId)
      if (group) return [...group.memberIds]
    } else if (initialFriendId) {
      return [meId, initialFriendId]
    }
    const friends = ledgerState.people.filter((p) =>
      isFriendOfUser({
        person: p,
        meId,
        expenses: ledgerState.expenses,
        settlements: ledgerState.settlements,
        groups: ledgerState.groups,
        isMe: (id) => store.isMe(id),
      })
    )
    return [meId, ...friends.map((p) => p.id)]
  })

  // Exact amounts state
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(() => {
    if (expenseToEdit?.shares && expenseToEdit.shares.length > 0) {
      const exactObj: Record<string, string> = {}
      for (const s of expenseToEdit.shares) {
        exactObj[s.owedBy] = (s.amountMinor / expenseToEdit.currency.scale).toString()
      }
      const sumOwed = expenseToEdit.shares.reduce((acc, s) => acc + s.amountMinor, 0)
      if (sumOwed < expenseToEdit.totalMinor) {
        exactObj[expenseToEdit.paidBy] = (
          (expenseToEdit.totalMinor - sumOwed) /
          expenseToEdit.currency.scale
        ).toString()
      }
      return exactObj
    }
    return {}
  })

  const [error, setError] = useState<string | null>(null)
  const totalMinor = Math.round((parseFloat(amountStr) || 0) * currency.scale)

  // Handle group change: adjust candidates and reset selected members
  const handleGroupChange = (val: string) => {
    const groupVal = val || null
    setGroupId(groupVal)
    setError(null)

    if (groupVal) {
      const grp = ledgerState.groups.find((g) => g.id === groupVal)
      if (grp) {
        setCurrency(grp.currency)
        setSelectedMemberIds([...grp.memberIds])
        // If current paidBy is not in the group, switch to me or first member
        if (!grp.memberIds.includes(paidBy)) {
          setPaidBy(grp.memberIds.includes(meId) ? meId : grp.memberIds[0] || meId)
        }
      }
    } else {
      // Switched to No Group (Direct 1:1 / multi-friend)
      const friends = ledgerState.people.filter((p) =>
        isFriendOfUser({
          person: p,
          meId,
          expenses: ledgerState.expenses,
          settlements: ledgerState.settlements,
          groups: ledgerState.groups,
          isMe: (id) => store.isMe(id),
        })
      )
      setSelectedMemberIds([meId, ...friends.map((p) => p.id)])
    }
  }

  // Toggling members in the split checklist must NEVER alter the paidBy selection
  const handleToggleMember = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((m) => m !== id))
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, id])
    }
  }

  // Calculate sum of exact amounts entered
  const sumExactMinor = useMemo(() => {
    if (mode !== 'exact') return 0
    return selectedMemberIds.reduce((sum, id) => {
      const val = parseFloat(exactAmounts[id] || '0') || 0
      return sum + Math.round(val * currency.scale)
    }, 0)
  }, [mode, selectedMemberIds, exactAmounts, currency.scale])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!description.trim()) {
      setError('Please provide a description.')
      return
    }
    if (isNaN(totalMinor) || totalMinor <= 0) {
      setError('Please enter a valid amount greater than zero.')
      return
    }
    if (!paidBy) {
      setError('Please select who paid for this expense.')
      return
    }
    if (selectedMemberIds.length === 0) {
      setError('Please select at least one person to split between.')
      return
    }

    try {
      let exactList: number[] | undefined

      if (mode === 'exact') {
        exactList = selectedMemberIds.map((m) =>
          Math.round((parseFloat(exactAmounts[m] || '0') || 0) * currency.scale)
        )
        const sum = exactList.reduce((a, b) => a + b, 0)
        if (sum !== totalMinor) {
          setError(
            `Exact amounts sum to ${new Money(sum, currency).plain()} but total is ${new Money(
              totalMinor,
              currency
            ).plain()}`
          )
          return
        }
      }

      // Parse date to createdAtMicros preserving current time within day
      let createdAtMicros = Date.now() * 1000
      if (expenseDate) {
        const [y, m, d] = expenseDate.split('-').map(Number)
        if (y && m && d) {
          const now = new Date()
          const dt = new Date(
            y,
            m - 1,
            d,
            now.getHours(),
            now.getMinutes(),
            now.getSeconds(),
            now.getMilliseconds()
          )
          createdAtMicros = dt.getTime() * 1000
        }
      }

      if (expenseToEdit) {
        await store.updateExpense({
          id: expenseToEdit.id,
          description: description.trim(),
          totalMinor,
          currency,
          paidBy,
          groupId,
          memberIds: selectedMemberIds,
          mode,
          categoryEmoji,
          createdAtMicros,
          exactAmounts: exactList,
        })
      } else {
        await store.addExpense({
          description: description.trim(),
          totalMinor,
          currency,
          paidBy,
          groupId,
          memberIds: selectedMemberIds,
          mode,
          categoryEmoji,
          createdAtMicros,
          exactAmounts: exactList,
        })
      }

      // Reset form & close
      setDescription('')
      setAmountStr('')
      setError(null)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }


  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* 1. Icon & Description */}
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
          Description
        </label>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              className="w-12 h-10 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] flex items-center justify-center text-xl transition-all cursor-pointer shadow-sm"
              title="Select expense category icon"
            >
              <span>{categoryEmoji}</span>
            </button>

            {showCategoryPicker && (
              <div className="absolute left-0 top-12 z-50 p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl grid grid-cols-4 gap-2 w-56 animate-fade-in">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setCategoryEmoji(c.key)
                      setShowCategoryPicker(false)
                    }}
                    className={`h-10 rounded-xl flex items-center justify-center text-xl hover:bg-primary/10 transition-colors cursor-pointer ${
                      categoryEmoji === c.key ? 'bg-primary/15 ring-2 ring-primary' : ''
                    }`}
                    title={c.label}
                  >
                    <span>{c.key}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            required
            placeholder="What was this expense for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex-1 px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary text-[var(--color-text)]"
          />
        </div>
      </div>

      {/* 2. Currency, Amount & Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="flex gap-2">
          <div className="w-28 shrink-0">
            <Select
              value={currency.code}
              onChange={(val) => {
                const found = SupportedCurrencies.find((c) => c.code === val)
                if (found) setCurrency(found)
              }}
              options={SupportedCurrencies.map((c) => ({
                value: c.code,
                label: `${c.code} (${c.symbol})`,
              }))}
              ariaLabel="Currency"
            />
          </div>
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              step={currency.digits === 0 ? '1' : currency.digits === 3 ? '0.001' : '0.01'}
              min="0"
              required
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl text-lg font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <div className="relative flex items-center">
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-semibold text-xs sm:text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              title="Select date of expense"
            />
          </div>
        </div>
      </div>

      {/* 3. Group Attribution (First) & 4. Paid by (Second) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            Group (Optional)
          </label>
          <Select
            value={groupId ?? ''}
            onChange={handleGroupChange}
            options={[
              { value: '', label: 'No Group (Direct 1:1)' },
              ...ledgerState.groups.map((g) => ({
                value: g.id,
                label: g.name,
              })),
            ]}
            ariaLabel="Group (Optional)"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            Paid by
          </label>
          <Select
            value={paidBy}
            onChange={(val) => setPaidBy(val)}
            options={candidatePeople.map((p) => ({
              value: p.id,
              label: p.id === meId ? 'You' : p.name,
            }))}
            ariaLabel="Paid by"
          />
        </div>
      </div>

      {/* 5. Split Mode Selector (Equally vs Exact amounts only) */}
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
          Split Mode
        </label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl">
          <button
            type="button"
            onClick={() => setMode('equal')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'equal'
                ? 'bg-primary text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Equally
          </button>
          <button
            type="button"
            onClick={() => setMode('exact')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'exact'
                ? 'bg-primary text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Exact amounts
          </button>
        </div>
      </div>

      {/* 6. Participants based on Group selection */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold text-[var(--color-text-muted)]">
            Split Between ({selectedMemberIds.length} {selectedMemberIds.length === 1 ? 'person' : 'people'})
          </label>
          {mode === 'exact' && totalMinor > 0 && (
            <span
              className={`text-xs font-bold ${
                sumExactMinor === totalMinor
                  ? 'text-emerald-500'
                  : 'text-amber-500'
              }`}
            >
              Allocated: {new Money(sumExactMinor, currency).plain()} / {new Money(totalMinor, currency).plain()}
            </span>
          )}
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto p-2 bg-[var(--color-surface-subtle)]/50 border border-[var(--color-border)] rounded-xl">
          {candidatePeople.map((person) => {
            const isSelected = selectedMemberIds.includes(person.id)
            const isPayer = person.id === paidBy

            // Calculated equal share preview
            const equalSharePreview =
              isSelected && selectedMemberIds.length > 0 && totalMinor > 0
                ? new Money(Math.round(totalMinor / selectedMemberIds.length), currency).plain()
                : null

            return (
              <div
                key={person.id}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-[var(--color-surface)] border-[var(--color-border)] shadow-xs'
                    : 'bg-transparent border-transparent opacity-60'
                }`}
              >
                <label className="flex items-center gap-2.5 cursor-pointer flex-1 select-none">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleMember(person.id)}
                    className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-[var(--color-text)]">
                      {person.id === meId ? 'You' : person.name}
                    </span>
                    {isPayer && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-primary/10 text-primary">
                        Payer
                      </span>
                    )}
                  </div>
                </label>

                {isSelected && (
                  <div className="flex items-center gap-2">
                    {mode === 'equal' && equalSharePreview && (
                      <span className="text-[11px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-subtle)] px-2 py-1 rounded-md">
                        {equalSharePreview}
                      </span>
                    )}
                    {mode === 'exact' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-[var(--color-text-muted)]">
                          {currency.symbol}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step={currency.digits === 0 ? '1' : currency.digits === 3 ? '0.001' : '0.01'}
                          placeholder="0.00"
                          value={exactAmounts[person.id] || ''}
                          onChange={(e) =>
                            setExactAmounts({ ...exactAmounts, [person.id]: e.target.value })
                          }
                          className="w-24 px-2 py-1 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-subtle)] font-bold text-right text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] transition-colors cursor-pointer text-[var(--color-text)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Icon name="check" size={14} />
          <span>{expenseToEdit ? 'Save Changes' : 'Save Expense'}</span>
        </button>
      </div>
    </form>
  )
}

export const ExpenseEditorModal: React.FC<ExpenseEditorModalProps> = ({
  isOpen,
  onClose,
  initialGroupId,
  initialFriendId,
  expenseToEdit,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={expenseToEdit ? 'Edit Expense' : 'Add Expense'}
      maxWidth="max-w-md"
    >
      <ExpenseEditorForm
        onClose={onClose}
        initialGroupId={initialGroupId}
        initialFriendId={initialFriendId}
        expenseToEdit={expenseToEdit}
      />
    </Modal>
  )
}

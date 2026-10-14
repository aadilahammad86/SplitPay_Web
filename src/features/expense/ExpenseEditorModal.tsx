import React, { useState, useEffect } from 'react'
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
  type SplitMode,
  SplitModeLabels,
  type Expense,
} from '../../domain/entities'
import { Icon, CategoryIcon } from '../../ui/components/Icon'

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
  const meId = ledgerState.localPersonId || ''

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
  const [mode, setMode] = useState<SplitMode>(() => expenseToEdit?.mode || 'equal')
  const [categoryEmoji, setCategoryEmoji] = useState(
    () => expenseToEdit?.categoryEmoji || '🧾'
  )
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => {
    if (expenseToEdit) {
      return Array.from(
        new Set([expenseToEdit.paidBy, ...expenseToEdit.shares.map((s) => s.owedBy)])
      )
    }
    if (initialGroupId) {
      const group = ledgerState.groups.find((g) => g.id === initialGroupId)
      if (group) return [...group.memberIds]
    } else if (initialFriendId) {
      return [meId, initialFriendId]
    }
    return [meId, ...ledgerState.people.filter((p) => p.id !== meId).map((p) => p.id)]
  })

  // Split-specific state
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(() => {
    if (expenseToEdit?.shares && expenseToEdit.shares.length > 0) {
      const exactObj: Record<string, string> = {}
      for (const s of expenseToEdit.shares) {
        exactObj[s.owedBy] = (s.amountMinor / expenseToEdit.currency.scale).toString()
      }
      return exactObj
    }
    return {}
  })
  const [percentages, setPercentages] = useState<Record<string, string>>({})
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [adjustments, setAdjustments] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const totalMinor = Math.round((parseFloat(amountStr) || 0) * currency.scale)

  const handleToggleMember = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      if (selectedMemberIds.length > 1) {
        setSelectedMemberIds(selectedMemberIds.filter((m) => m !== id))
      }
    } else {
      setSelectedMemberIds([...selectedMemberIds, id])
    }
  }

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
    if (!paidBy || !selectedMemberIds.includes(paidBy)) {
      setError('The payer must be one of the participants.')
      return
    }

    try {
      let exactList: number[] | undefined
      let bpList: number[] | undefined
      let weightsList: number[] | undefined
      let adjList: number[] | undefined

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
      } else if (mode === 'percentage') {
        bpList = selectedMemberIds.map((m) =>
          Math.round((parseFloat(percentages[m] || '0') || 0) * 100)
        )
        const sum = bpList.reduce((a, b) => a + b, 0)
        if (sum !== 10000) {
          setError(
            `Percentages must total 100.00%, current sum is ${(sum / 100).toFixed(2)}%`
          )
          return
        }
      } else if (mode === 'shares') {
        weightsList = selectedMemberIds.map((m) => parseInt(weights[m] || '1', 10) || 1)
      } else if (mode === 'adjustment') {
        adjList = selectedMemberIds.map((m) =>
          Math.round((parseFloat(adjustments[m] || '0') || 0) * currency.scale)
        )
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
          basisPoints: bpList,
          weights: weightsList,
          adjustments: adjList,
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
          basisPoints: bpList,
          weights: weightsList,
          adjustments: adjList,
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

  const peopleMap = new Map(ledgerState.people.map((p) => [p.id, p]))

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Category Picker and Description */}
      <div className="flex gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCategoryPicker(!showCategoryPicker)}
            className="h-11 px-3 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Select category icon"
          >
            <CategoryIcon category={categoryEmoji} size={22} className="text-primary" />
            <Icon name="chevronDown" size={14} className="text-[var(--color-text-muted)]" />
          </button>

          {showCategoryPicker && (
            <div className="absolute left-0 top-12 z-30 w-64 p-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xl grid grid-cols-4 gap-1.5 animate-slide-up">
              {CATEGORIES.map((cat) => {
                const isSelected = categoryEmoji === cat.key
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setCategoryEmoji(cat.key)
                      setShowCategoryPicker(false)
                    }}
                    title={cat.label}
                    className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-primary text-white shadow-sm'
                        : 'hover:bg-[var(--color-surface-subtle)] text-[var(--color-text)]'
                    }`}
                  >
                    <CategoryIcon category={cat.key} size={20} />
                    <span className="text-[9px] font-medium truncate max-w-full">
                      {cat.label.split('/')[0].trim()}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <input
          type="text"
          required
          placeholder="What was this expense for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Amount, Currency & Date Picker */}
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
          <label className="block text-[11px] font-semibold text-[var(--color-text-muted)] mb-1 sm:hidden">
            Expense Date
          </label>
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

      {/* Paid By and Group Attribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            Paid by
          </label>
          <Select
            value={paidBy}
            onChange={(val) => setPaidBy(val)}
            options={selectedMemberIds.map((id) => ({
              value: id,
              label: id === me?.id ? 'You' : peopleMap.get(id)?.name ?? 'Unknown',
            }))}
            ariaLabel="Paid by"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
            Group (Optional)
          </label>
          <Select
            value={groupId ?? ''}
            onChange={(val) => {
              const groupVal = val || null
              setGroupId(groupVal)
              if (groupVal) {
                const grp = ledgerState.groups.find((g) => g.id === groupVal)
                if (grp) {
                  setCurrency(grp.currency)
                  setSelectedMemberIds([...grp.memberIds])
                }
              }
            }}
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
      </div>

      {/* Split Mode Selector */}
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
          Split Mode
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 p-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl">
          {(['equal', 'exact', 'percentage', 'shares', 'adjustment'] as SplitMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === m
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {SplitModeLabels[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Participants & Share breakdown inputs */}
      <div>
        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-2">
          Split Between ({selectedMemberIds.length} people)
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-[var(--color-surface-subtle)]/50 border border-[var(--color-border)] rounded-xl">
          {ledgerState.people.map((person) => {
            const isSelected = selectedMemberIds.includes(person.id)
            return (
              <div
                key={person.id}
                className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]"
              >
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleMember(person.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-xs">
                    {person.id === me?.id ? 'You' : person.name}
                  </span>
                </label>

                {isSelected && (
                  <div className="flex items-center gap-2">
                    {mode === 'exact' && (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        placeholder="Amount"
                        value={exactAmounts[person.id] || ''}
                        onChange={(e) =>
                          setExactAmounts({ ...exactAmounts, [person.id]: e.target.value })
                        }
                        className="w-24 px-2 py-1 text-xs border rounded bg-[var(--color-surface-subtle)] font-bold text-right"
                      />
                    )}
                    {mode === 'percentage' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          placeholder="%"
                          value={percentages[person.id] || ''}
                          onChange={(e) =>
                            setPercentages({ ...percentages, [person.id]: e.target.value })
                          }
                          className="w-16 px-2 py-1 text-xs border rounded bg-[var(--color-surface-subtle)] font-bold text-right"
                        />
                        <span className="text-xs font-bold">%</span>
                      </div>
                    )}
                    {mode === 'shares' && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          placeholder="1"
                          value={weights[person.id] || '1'}
                          onChange={(e) =>
                            setWeights({ ...weights, [person.id]: e.target.value })
                          }
                          className="w-14 px-2 py-1 text-xs border rounded bg-[var(--color-surface-subtle)] font-bold text-right"
                        />
                        <span className="text-xs text-[var(--color-text-muted)]">share(s)</span>
                      </div>
                    )}
                    {mode === 'adjustment' && (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        placeholder="+/- 0"
                        value={adjustments[person.id] || '0'}
                        onChange={(e) =>
                          setAdjustments({ ...adjustments, [person.id]: e.target.value })
                        }
                        className="w-20 px-2 py-1 text-xs border rounded bg-[var(--color-surface-subtle)] font-bold text-right"
                      />
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
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] transition-colors cursor-pointer"
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
  initialGroupId = null,
  initialFriendId = null,
  expenseToEdit = null,
}) => {
  const [shouldRenderForm, setShouldRenderForm] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      setShouldRenderForm(true)
    } else {
      const timer = setTimeout(() => setShouldRenderForm(false), 250)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={expenseToEdit ? 'Edit Expense' : 'Add Expense'}
      maxWidth="max-w-xl"
    >
      {(isOpen || shouldRenderForm) && (
        <ExpenseEditorForm
          key={expenseToEdit?.id ?? 'new_expense'}
          onClose={onClose}
          initialGroupId={initialGroupId}
          initialFriendId={initialFriendId}
          expenseToEdit={expenseToEdit}
        />
      )}
    </Modal>
  )
}

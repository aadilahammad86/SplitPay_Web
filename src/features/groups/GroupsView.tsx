import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { simplifyDebts } from '../../domain/splitEngine'
import { groupNets } from '../../domain/balance'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { Modal } from '../../ui/components/Modal'
import { Select } from '../../ui/components/Select'
import { ExpenseEditorModal } from '../expense/ExpenseEditorModal'
import { SettleUpModal } from '../settle/SettleUpModal'
import { CreateGroupModal } from './CreateGroupModal'
import {
  type Group,
  GroupKindInfo,
} from '../../domain/entities'
import { Icon, CategoryIcon } from '../../ui/components/Icon'

interface GroupsViewProps {
  onNavigateToGroupStatement: (groupId: string) => void
}

export const GroupsView: React.FC<GroupsViewProps> = ({ onNavigateToGroupStatement }) => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''

  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettle, setShowSettle] = useState(false)
  const [settleFrom, setSettleFrom] = useState('')
  const [settleTo, setSettleTo] = useState('')
  const [settleAmount, setSettleAmount] = useState(0)

  const [showAddMember, setShowAddMember] = useState(false)
  const [memberToAdd, setMemberToAdd] = useState('')

  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())

  const handleToggleSelect = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedGroupIds.size === ledgerState.groups.length) {
      setSelectedGroupIds(new Set())
    } else {
      setSelectedGroupIds(new Set(ledgerState.groups.map((g) => g.id)))
    }
  }

  const handleDeleteSingleGroup = async (group: Group) => {
    if (confirm(`Are you sure you want to delete the group "${group.name}"?`)) {
      await store.deleteGroup(group.id)
      if (selectedGroup?.id === group.id) setSelectedGroup(null)
      setSelectedGroupIds((prev) => {
        const next = new Set(prev)
        next.delete(group.id)
        return next
      })
    }
  }

  const handleDeleteSelectedGroups = async () => {
    if (selectedGroupIds.size === 0) return
    if (confirm(`Are you sure you want to delete ${selectedGroupIds.size} selected group(s)?`)) {
      await store.deleteGroups(Array.from(selectedGroupIds))
      if (selectedGroup && selectedGroupIds.has(selectedGroup.id)) {
        setSelectedGroup(null)
      }
      setSelectedGroupIds(new Set())
      setIsSelectMode(false)
    }
  }

  const handleRemoveMemberFromGroup = async (memberId: string) => {
    if (!selectedGroup) return
    const personName = memberId === meId ? 'yourself' : peopleMap.get(memberId)?.name || 'this member'
    if (confirm(`Are you sure you want to remove ${personName} from "${selectedGroup.name}"?`)) {
      await store.removeGroupMember(selectedGroup.id, memberId)
      const updated = ledgerState.groups.find((g) => g.id === selectedGroup.id)
      if (updated) setSelectedGroup(updated)
    }
  }

  const handleAddMemberToGroup = async () => {
    if (!selectedGroup || !memberToAdd) return
    await store.addGroupMember(selectedGroup.id, memberToAdd)
    const updated = ledgerState.groups.find((g) => g.id === selectedGroup.id)
    if (updated) setSelectedGroup(updated)
    setShowAddMember(false)
    setMemberToAdd('')
  }

  // Simplified Debts for selected group
  const debtPlan = selectedGroup
    ? simplifyDebts(
        groupNets({
          group: selectedGroup,
          expenses: ledgerState.expenses,
          settlements: ledgerState.settlements,
        })
      )
    : []

  const groupExpenses = selectedGroup
    ? ledgerState.expenses.filter((e) => !e.isTombstone && e.groupId === selectedGroup.id)
    : []

  const peopleMap = new Map(ledgerState.people.map((p) => [p.id, p]))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
            Your Groups ({ledgerState.groups.length})
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Trips, flatmates, and events with automatic debt simplification
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ledgerState.groups.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsSelectMode(!isSelectMode)
                setSelectedGroupIds(new Set())
              }}
              className={`px-3 py-2.5 font-bold text-xs rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 shrink-0 cursor-pointer ${
                isSelectMode
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)]'
              }`}
            >
              <Icon name="check" size={15} />
              <span>{isSelectMode ? 'Done' : 'Select'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 shrink-0 cursor-pointer"
          >
            <Icon name="plus" size={16} />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* Batch Action Toolbar */}
      {isSelectMode && (
        <div className="p-3 bg-[var(--color-surface)] border-2 border-primary/40 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
            >
              <span>{selectedGroupIds.size === ledgerState.groups.length && ledgerState.groups.length > 0 ? 'Deselect All' : 'Select All'}</span>
            </button>
            <span className="text-xs text-[var(--color-text-muted)] font-semibold">
              {selectedGroupIds.size} of {ledgerState.groups.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedGroupIds.size === 0}
              onClick={handleDeleteSelectedGroups}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Icon name="delete" size={14} />
              <span>Delete Selected Groups ({selectedGroupIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Groups Grid */}
      {ledgerState.groups.length === 0 ? (
        <div className="p-10 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-primary-subtle text-primary flex items-center justify-center text-3xl mx-auto shadow-sm">
            <Icon name="users" size={32} />
          </div>
          <h3 className="font-bold text-base text-[var(--color-text)]">No groups created yet</h3>
          <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto">
            Create a group for an upcoming vacation, shared household, or dinner party to track pool expenses.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="mt-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-md hover:bg-primary-hover transition-all inline-flex items-center gap-1.5 active:scale-95"
          >
            <Icon name="plus" size={14} />
            <span>Create your first group</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ledgerState.groups.map((group) => {
            const kindInfo = GroupKindInfo[group.kind]
            const totalGroupSpendMinor = ledgerState.expenses
              .filter((e) => !e.isTombstone && e.groupId === group.id)
              .reduce((acc, e) => acc + e.totalMinor, 0)
            const isSelected = selectedGroupIds.has(group.id)

            return (
              <div
                key={group.id}
                onClick={() => {
                  if (isSelectMode) {
                    handleToggleSelect(group.id)
                  } else {
                    setSelectedGroup(group)
                  }
                }}
                className={`p-5 bg-[var(--color-surface)] border rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 card-hover ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-[var(--color-border)] hover:border-primary/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {isSelectMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(group.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded text-primary focus:ring-primary shrink-0 cursor-pointer"
                        />
                      )}
                      <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-primary shadow-inner">
                        <CategoryIcon category={kindInfo.emoji} size={24} />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                      {group.currency.code}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-bold text-sm text-[var(--color-text)] truncate">
                      {group.name}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {group.memberIds.length} members · {kindInfo.label}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                    Total Pool Spend
                  </span>
                  <div className="flex items-center gap-2">
                    <MoneyDisplay
                      minor={totalGroupSpendMinor}
                      currency={group.currency}
                      size="md"
                      showSign={false}
                      showColor={false}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSingleGroup(group)
                      }}
                      className="p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors cursor-pointer"
                      title="Delete Group"
                    >
                      <Icon name="delete" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(gId) => {
          const created = ledgerState.groups.find((g) => g.id === gId)
          if (created) setSelectedGroup(created)
        }}
      />

      {/* Group Detail Modal */}
      {selectedGroup && (
        <Modal
          isOpen={Boolean(selectedGroup)}
          onClose={() => setSelectedGroup(null)}
          title={
            <span className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-primary-subtle text-primary flex items-center justify-center">
                <CategoryIcon category={GroupKindInfo[selectedGroup.kind].emoji} size={18} />
              </span>
              <span>{selectedGroup.name}</span>
            </span>
          }
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5 text-sm">
            {/* Action Bar */}
            <div className="flex flex-wrap gap-2 items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {selectedGroup.memberIds.length} members · {selectedGroup.currency.code}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddMember(true)}
                  className="px-2.5 py-1 text-xs rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] font-medium inline-flex items-center gap-1"
                >
                  <Icon name="plus" size={12} />
                  <span>Add Member</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(true)}
                  className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl text-xs shadow-sm transition-all inline-flex items-center gap-1"
                >
                  <Icon name="plus" size={14} />
                  <span>Expense</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedGroup.id
                    setSelectedGroup(null)
                    onNavigateToGroupStatement(id)
                  }}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] font-semibold rounded-xl text-xs inline-flex items-center gap-1"
                >
                  <Icon name="chart" size={14} />
                  <span>Statement</span>
                </button>
              </div>
            </div>

            {/* Group Members */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                  Group Members ({selectedGroup.memberIds.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddMember(true)}
                  className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Icon name="plus" size={12} />
                  <span>Add Member</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedGroup.memberIds.map((mId) => {
                  const person = peopleMap.get(mId)
                  const isMe = mId === meId
                  return (
                    <div
                      key={mId}
                      className="px-2.5 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <span className="font-semibold text-[var(--color-text)]">
                        {isMe ? 'You' : person?.name || 'Unknown'}
                      </span>
                      {selectedGroup.memberIds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberFromGroup(mId)}
                          className="w-4 h-4 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
                          title={`Remove ${isMe ? 'yourself' : person?.name || 'member'} from group`}
                        >
                          <Icon name="close" size={10} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Simplified Debts Plan (Debt Simplification Algorithm - SE-V1) */}
            <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text)]">
                    Simplified Repayment Plan
                  </h4>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Calculated via min-cash-flow (fewer payments)
                  </p>
                </div>
              </div>

              {debtPlan.length === 0 ? (
                <div className="p-3 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                  <Icon name="check" size={16} />
                  <span>All balances in this group are settled!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {debtPlan.map((transfer, idx) => {
                    const debtorName = transfer.from === meId ? 'You' : peopleMap.get(transfer.from)?.name || 'Unknown'
                    const creditorName = transfer.to === meId ? 'You' : peopleMap.get(transfer.to)?.name || 'Unknown'

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-[var(--color-text)]">{debtorName}</span>
                          <span className="text-[var(--color-text-muted)]">pays</span>
                          <span className="font-bold text-[var(--color-text)]">{creditorName}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <MoneyDisplay
                            minor={transfer.amountMinor}
                            currency={selectedGroup.currency}
                            size="sm"
                            showSign={false}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSettleFrom(transfer.from)
                              setSettleTo(transfer.to)
                              setSettleAmount(transfer.amountMinor)
                              setShowSettle(true)
                            }}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm inline-flex items-center gap-1"
                          >
                            <Icon name="moneyHand" size={12} />
                            <span>Settle</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Group Expenses List */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Group Expenses ({groupExpenses.length})
              </h4>
              {groupExpenses.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] italic">No expenses recorded in this group yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {groupExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-primary">
                          <CategoryIcon category={exp.categoryEmoji} size={16} />
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-[var(--color-text)]">{exp.description}</p>
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            Paid by {exp.paidBy === meId ? 'You' : peopleMap.get(exp.paidBy)?.name || 'Unknown'} ·{' '}
                            {new Date(Math.floor(exp.createdAtMicros / 1000)).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      <MoneyDisplay
                        minor={exp.totalMinor}
                        currency={exp.currency}
                        size="sm"
                        showSign={false}
                        showColor={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with Delete Group */}
            <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteSingleGroup(selectedGroup)}
                className="px-3.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl transition-colors inline-flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Icon name="delete" size={14} />
                <span>Delete Group</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Member Modal */}
      {showAddMember && selectedGroup && (
        <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Add Member to Group">
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                Select Person
              </label>
              <Select
                value={memberToAdd}
                onChange={(val) => setMemberToAdd(val)}
                placeholder="Select a friend..."
                options={[
                  { value: '', label: 'Select a friend...' },
                  ...ledgerState.people
                    .filter((p) => !selectedGroup.memberIds.includes(p.id))
                    .map((p) => ({
                      value: p.id,
                      label: p.name,
                    })),
                ]}
                ariaLabel="Select Person"
              />
            </div>
            <div className="pt-2 border-t border-[var(--color-border)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddMember(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!memberToAdd}
                onClick={handleAddMemberToGroup}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md"
              >
                Add Member
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Sub-modals for Expense & Settle */}
      {showAddExpense && selectedGroup && (
        <ExpenseEditorModal
          isOpen={showAddExpense}
          onClose={() => setShowAddExpense(false)}
          initialGroupId={selectedGroup.id}
        />
      )}

      {showSettle && selectedGroup && (
        <SettleUpModal
          isOpen={showSettle}
          onClose={() => setShowSettle(false)}
          initialGroupId={selectedGroup.id}
          initialAmountMinor={settleAmount}
          initialFromId={settleFrom}
          initialToId={settleTo}
        />
      )}
    </div>
  )
}

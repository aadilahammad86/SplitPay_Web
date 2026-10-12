import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { breakdownFor } from '../../domain/balance'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { SourceChips } from '../../ui/components/SourceChips'
import { Modal } from '../../ui/components/Modal'
import { SettleUpModal } from '../settle/SettleUpModal'
import { EditFriendModal } from './EditFriendModal'
import { ContactSyncModal } from '../contacts/ContactSyncModal'
import { BASE_CURRENCY, personInitials, type Person } from '../../domain/entities'
import { Icon, CategoryIcon } from '../../ui/components/Icon'
import { getSupabaseClient } from '../../supabase/supabaseClient'

interface FriendsViewProps {
  onNavigateToStatement: (friendId: string) => void
}

export const FriendsView: React.FC<FriendsViewProps> = ({ onNavigateToStatement }) => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''

  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [friendName, setFriendName] = useState('')
  const [friendHandle, setFriendHandle] = useState('')
  const [selectedFriend, setSelectedFriend] = useState<Person | null>(null)
  const [editingFriend, setEditingFriend] = useState<Person | null>(null)
  const [showSettle, setShowSettle] = useState(false)
  const [showContactsModal, setShowContactsModal] = useState(false)
  const [settleFriendId, setSettleFriendId] = useState<string | null>(null)
  const [settleAmountMinor, setSettleAmountMinor] = useState(0)

  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set())
  const currentCurrency = ledgerState.defaultCurrency || BASE_CURRENCY

  const friends = ledgerState.people.filter(
    (p) =>
      !store.isMe(p.id) &&
      p.name !== 'You' &&
      p.name !== 'SplitPay Friend' &&
      p.name !== 'Guest User' &&
      !p.id.startsWith('invited_') &&
      p.name.trim() !== ''
  )
  const filtered = friends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.handle && f.handle.toLowerCase().includes(search.toLowerCase()))
  )

  const handleToggleSelect = (id: string) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedFriendIds.size === filtered.length) {
      setSelectedFriendIds(new Set())
    } else {
      setSelectedFriendIds(new Set(filtered.map((f) => f.id)))
    }
  }

  const handleRemoveSingleFriend = async (friend: Person) => {
    if (confirm(`Are you sure you want to remove "${friend.name}" from your friends list?`)) {
      await store.removeFriend(friend.id)
      setSelectedFriendIds((prev) => {
        const next = new Set(prev)
        next.delete(friend.id)
        return next
      })
    }
  }

  const handleRemoveSelectedFriends = async () => {
    if (selectedFriendIds.size === 0) return
    if (confirm(`Are you sure you want to remove ${selectedFriendIds.size} selected friend(s)?`)) {
      await store.removeFriends(Array.from(selectedFriendIds))
      setSelectedFriendIds(new Set())
      setIsSelectMode(false)
    }
  }

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!friendName.trim()) return

    const trimmedName = friendName.trim()
    const cleanHandle = friendHandle.trim().replace(/^@/, '') || undefined

    let resolvedId: string | undefined
    let resolvedPhone: string | undefined
    let resolvedName = trimmedName

    // Lookup existing cloud profile by handle if Supabase is connected
    try {
      const supabase = getSupabaseClient()
      if (supabase && cleanHandle) {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, handle, phone')
          .ilike('handle', cleanHandle)
          .maybeSingle()
        if (data) {
          resolvedId = data.id
          if (data.name) resolvedName = data.name
          if (data.phone) resolvedPhone = data.phone
        }
      }
    } catch {
      // offline fallback
    }

    await store.addFriend(resolvedName, cleanHandle, {
      id: resolvedId,
      phone: resolvedPhone,
      phoneVerified: !!resolvedPhone,
    })
    setFriendName('')
    setFriendHandle('')
    setShowAddModal(false)
  }

  const selectedFriendBreakdown = selectedFriend
    ? breakdownFor({
        me: meId,
        friend: selectedFriend.id,
        expenses: ledgerState.expenses,
        settlements: ledgerState.settlements,
        isMe: (id) => store.isMe(id),
      })
    : null

  // Mutual transactions with selected friend
  const mutualTransactions = selectedFriend
    ? [
        ...ledgerState.expenses
          .filter((e) =>
            !e.isTombstone &&
            e.shares.some(
              (s) =>
                (s.owedBy === selectedFriend.id && store.isMe(s.owedTo)) ||
                (store.isMe(s.owedBy) && s.owedTo === selectedFriend.id)
            )
          )
          .map((e) => {
            const myShare = e.shares.find((s) => store.isMe(s.owedBy))?.amountMinor ?? 0
            const friendShare = e.shares.find((s) => s.owedBy === selectedFriend.id)?.amountMinor ?? 0
            return {
              id: e.id,
              title: e.description,
              totalMinor: e.totalMinor,
              relevantMinor: store.isMe(e.paidBy) ? friendShare : myShare,
              currency: e.currency,
              createdAtMicros: e.createdAtMicros,
              emoji: e.categoryEmoji,
              isSettlement: false,
              paidByMe: store.isMe(e.paidBy),
            }
          }),
        ...ledgerState.settlements
          .filter(
            (s) =>
              !s.isTombstone &&
              ((store.isMe(s.from) && s.to === selectedFriend.id) ||
                (s.from === selectedFriend.id && store.isMe(s.to)))
          )
          .map((s) => ({
            id: s.id,
            title: store.isMe(s.from) ? `Payment to ${selectedFriend.name}` : `Payment from ${selectedFriend.name}`,
            totalMinor: s.amountMinor,
            relevantMinor: s.amountMinor,
            currency: s.currency,
            createdAtMicros: s.createdAtMicros,
            emoji: '🤝',
            isSettlement: true,
            paidByMe: store.isMe(s.from),
          })),
      ].sort((a, b) => b.createdAtMicros - a.createdAtMicros)
    : []

  const handleOpenSettle = (fId: string, amountMinor: number) => {
    setSettleFriendId(fId)
    setSettleAmountMinor(amountMinor)
    setShowSettle(true)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search & Add Friend Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] tracking-tight">
            Friends ({friends.length})
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Individual balance breakdowns, direct settlements, and source chips
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)] flex items-center">
              <Icon name="search" size={16} />
            </span>
            <input
              type="text"
              placeholder="Search friends..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-medium text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowContactsModal(true)}
            className="px-3.5 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
            title="Find friends from your contacts"
          >
            <Icon name="users" size={15} />
            <span className="hidden sm:inline">Sync Contacts</span>
          </button>
          {friends.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsSelectMode(!isSelectMode)
                setSelectedFriendIds(new Set())
              }}
              className={`px-3 py-2.5 font-bold text-xs rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 shrink-0 ${
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
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
          >
            <Icon name="plus" size={16} />
            <span>Add Friend</span>
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
              <span>{selectedFriendIds.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}</span>
            </button>
            <span className="text-xs text-[var(--color-text-muted)] font-semibold">
              {selectedFriendIds.size} of {filtered.length} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedFriendIds.size === 0}
              onClick={handleRemoveSelectedFriends}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Icon name="delete" size={14} />
              <span>Remove Selected ({selectedFriendIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Friends Responsive Grid */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-primary-subtle text-primary flex items-center justify-center text-3xl mx-auto shadow-sm">
            <Icon name="users" size={32} />
          </div>
          <h3 className="font-bold text-base text-[var(--color-text)]">
            {search ? 'No friends match your search' : 'No friends added yet'}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto">
            {search
              ? 'Try searching with a different name or clear the search filter.'
              : 'Add friends to start splitting expenses directly or tracking shared group costs.'}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center gap-1.5"
            >
              <Icon name="plus" size={14} />
              <span>Add First Friend</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((friend) => {
            const breakdown = breakdownFor({
              me: meId,
              friend: friend.id,
              expenses: ledgerState.expenses,
              settlements: ledgerState.settlements,
              isMe: (id) => store.isMe(id),
            })
            const isSelected = selectedFriendIds.has(friend.id)

            return (
              <div
                key={friend.id}
                onClick={() => {
                  if (isSelectMode) {
                    handleToggleSelect(friend.id)
                  } else {
                    setSelectedFriend(friend)
                  }
                }}
                className={`p-5 bg-[var(--color-surface)] border rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 card-hover ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-[var(--color-border)] hover:border-primary/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {isSelectMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(friend.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded text-primary focus:ring-primary shrink-0 cursor-pointer"
                        />
                      )}
                      <div className="w-12 h-12 rounded-2xl hero-gradient text-white font-extrabold flex items-center justify-center text-sm shadow-sm shrink-0">
                        {personInitials(friend.name)}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-sm text-[var(--color-text)] truncate">
                          {friend.name}
                        </h3>
                        {friend.handle ? (
                          <span className="text-xs text-[var(--color-text-muted)]">@{friend.handle}</span>
                        ) : (
                          <span className="text-[11px] text-[var(--color-text-muted)]">Friend</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <MoneyDisplay
                        minor={breakdown.netMinor}
                        currency={currentCurrency}
                        size="md"
                        showSign={true}
                      />
                      <span className={`block text-[11px] font-semibold mt-0.5 ${
                        breakdown.netMinor > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : breakdown.netMinor < 0
                          ? 'text-rose-500 dark:text-rose-400'
                          : 'text-[var(--color-text-muted)]'
                      }`}>
                        {breakdown.netMinor > 0
                          ? 'owes you'
                          : breakdown.netMinor < 0
                          ? 'you owe'
                          : 'all square'}
                      </span>
                    </div>
                  </div>

                  {/* Source Chips Decomposition (SE-12) */}
                  {breakdown.slices.length > 0 && (
                    <div className="pt-3 border-t border-[var(--color-border)] mt-3">
                      <SourceChips
                        slices={breakdown.slices}
                        groups={ledgerState.groups}
                        defaultCurrency={currentCurrency}
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                  <span className="text-[11px]">Click to view history</span>
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setEditingFriend(friend)}
                      className="px-2.5 py-1 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl border border-[var(--color-border)] transition-colors inline-flex items-center gap-1"
                      title="Edit Friend"
                    >
                      <Icon name="edit" size={13} />
                      <span>Edit</span>
                    </button>
                    {breakdown.netMinor !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenSettle(friend.id, breakdown.netMinor)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors inline-flex items-center gap-1"
                      >
                        <Icon name="moneyHand" size={13} />
                        <span>Settle</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigateToStatement(friend.id)}
                      className="px-2.5 py-1 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl border border-[var(--color-border)] transition-colors inline-flex items-center gap-1"
                    >
                      <Icon name="chart" size={13} />
                      <span>Statement</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSingleFriend(friend)}
                      className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-colors inline-flex items-center gap-1"
                      title="Remove Friend"
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

      {/* Add Friend Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add a Friend">
        <form onSubmit={handleAddFriend} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Friend's Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Handle or Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. rahul_s"
              value={friendHandle}
              onChange={(e) => setFriendHandle(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md transition-all inline-flex items-center gap-1.5"
            >
              <Icon name="check" size={14} />
              <span>Save Friend</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Friend Detail Modal */}
      {selectedFriend && selectedFriendBreakdown && (
        <Modal
          isOpen={Boolean(selectedFriend)}
          onClose={() => setSelectedFriend(null)}
          title={`Balance with ${selectedFriend.name}`}
          maxWidth="max-w-xl"
        >
          <div className="space-y-5 text-sm">
            {/* Top Balance Banner */}
            <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-[var(--color-text-muted)] font-medium">
                  Net Balance Status
                </span>
                <div className="text-xl font-extrabold">
                  <MoneyDisplay
                    minor={selectedFriendBreakdown.netMinor}
                    currency={currentCurrency}
                    size="lg"
                    showSign={true}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = selectedFriend
                    setSelectedFriend(null)
                    setEditingFriend(toEdit)
                  }}
                  className="px-3.5 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Icon name="edit" size={14} />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toRemove = selectedFriend
                    setSelectedFriend(null)
                    handleRemoveSingleFriend(toRemove)
                  }}
                  className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-semibold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Icon name="delete" size={14} />
                  <span>Remove</span>
                </button>
                {selectedFriendBreakdown.netMinor !== 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedFriend.id
                      const net = selectedFriendBreakdown.netMinor
                      setSelectedFriend(null)
                      handleOpenSettle(id, net)
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
                  >
                    <Icon name="moneyHand" size={14} />
                    <span>Settle Up</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedFriend.id
                    setSelectedFriend(null)
                    onNavigateToStatement(id)
                  }}
                  className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl transition-all inline-flex items-center gap-1.5"
                >
                  <Icon name="chart" size={14} />
                  <span>Statement</span>
                </button>
              </div>
            </div>

            {/* Source Chips Detail */}
            {selectedFriendBreakdown.slices.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Decomposed Balance Sources
                </h4>
                <SourceChips
                  slices={selectedFriendBreakdown.slices}
                  groups={ledgerState.groups}
                  defaultCurrency={currentCurrency}
                />
              </div>
            )}

            {/* Mutual Transactions Timeline */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Shared Transactions ({mutualTransactions.length})
              </h4>
              {mutualTransactions.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                  No mutual expenses or payments yet.
                </p>
              ) : (
                <div className="divide-y divide-[var(--color-border)] max-h-64 overflow-y-auto pr-1">
                  {mutualTransactions.map((tx) => (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-primary">
                          <CategoryIcon category={tx.emoji} size={15} />
                        </div>
                        <div>
                          <p className="font-bold text-[var(--color-text)]">{tx.title}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">
                            {new Date(Math.floor(tx.createdAtMicros / 1000)).toLocaleDateString()} ·{' '}
                            {tx.paidByMe ? 'You paid' : `${selectedFriend.name} paid`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <MoneyDisplay
                          minor={tx.relevantMinor}
                          currency={tx.currency}
                          size="sm"
                          showSign={false}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Settle Up Modal */}
      {showSettle && (
        <SettleUpModal
          isOpen={showSettle}
          onClose={() => setShowSettle(false)}
          initialFriendId={settleFriendId}
          initialAmountMinor={settleAmountMinor}
        />
      )}

      {/* Edit Friend Modal */}
      <EditFriendModal
        isOpen={!!editingFriend}
        onClose={() => setEditingFriend(null)}
        friend={editingFriend}
      />

      {/* Contact Sync Modal */}
      <ContactSyncModal
        isOpen={showContactsModal}
        onClose={() => setShowContactsModal(false)}
      />
    </div>
  )
}

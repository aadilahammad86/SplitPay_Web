import React, { useState } from 'react'
import { useStore } from '../../ui/storeContext'
import { breakdownFor } from '../../domain/balance'
import { MoneyDisplay } from '../../ui/components/MoneyDisplay'
import { SourceChips } from '../../ui/components/SourceChips'
import { Modal } from '../../ui/components/Modal'
import { SettleUpModal } from '../settle/SettleUpModal'
import { BASE_CURRENCY, personInitials, type Person } from '../../domain/entities'

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
  const [settleFriendId, setSettleFriendId] = useState<string | null>(null)
  const [settleAmountMinor, setSettleAmountMinor] = useState(0)

  const friends = ledgerState.people.filter((p) => p.id !== meId)
  const filtered = friends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.handle && f.handle.toLowerCase().includes(search.toLowerCase()))
  )

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!friendName.trim()) return
    await store.addFriend(friendName.trim(), friendHandle.trim() || undefined)
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
                (s.owedBy === selectedFriend.id && s.owedTo === meId) ||
                (s.owedBy === meId && s.owedTo === selectedFriend.id)
            )
          )
          .map((e) => {
            const myShare = e.shares.find((s) => s.owedBy === meId)?.amountMinor ?? 0
            const friendShare = e.shares.find((s) => s.owedBy === selectedFriend.id)?.amountMinor ?? 0
            return {
              id: e.id,
              title: e.description,
              totalMinor: e.totalMinor,
              relevantMinor: e.paidBy === meId ? friendShare : myShare,
              currency: e.currency,
              date: new Date(Math.floor(e.createdAtMicros / 1000)),
              emoji: e.categoryEmoji,
              isSettlement: false,
              paidByMe: e.paidBy === meId,
            }
          }),
        ...ledgerState.settlements
          .filter(
            (s) =>
              (s.from === meId && s.to === selectedFriend.id) ||
              (s.from === selectedFriend.id && s.to === meId)
          )
          .map((s) => ({
            id: s.id,
            title: s.from === meId ? `Payment to ${selectedFriend.name}` : `Payment from ${selectedFriend.name}`,
            totalMinor: s.amountMinor,
            relevantMinor: s.amountMinor,
            currency: s.currency,
            date: new Date(Math.floor(s.createdAtMicros / 1000)),
            emoji: '🤝',
            isSettlement: true,
            paidByMe: s.from === meId,
          })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime())
    : []

  return (
    <div className="space-y-4">
      {/* Search and Add Friend Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search friends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3.5 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center gap-1.5"
        >
          <span>+</span>
          <span>Add Friend</span>
        </button>
      </div>

      {/* Friends List */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
          <p className="text-sm text-[var(--color-text-muted)]">
            {search ? 'No friends match your search.' : 'You have not added any friends yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filtered.map((friend) => {
            const breakdown = breakdownFor({
              me: meId,
              friend: friend.id,
              expenses: ledgerState.expenses,
              settlements: ledgerState.settlements,
            })

            return (
              <div
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-indigo-500/50 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-base">
                      {personInitials(friend.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[var(--color-text)]">{friend.name}</h3>
                      {friend.handle && (
                        <span className="text-xs text-[var(--color-text-muted)]">@{friend.handle}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <MoneyDisplay
                      minor={breakdown.netMinor}
                      currency={BASE_CURRENCY}
                      size="md"
                      showSign={true}
                    />
                    <span className="block text-[11px] text-[var(--color-text-muted)]">
                      {breakdown.netMinor > 0 ? 'owes you' : breakdown.netMinor < 0 ? 'you owe' : 'settled up'}
                    </span>
                  </div>
                </div>

                <SourceChips
                  slices={breakdown.slices}
                  groups={ledgerState.groups}
                />
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
              Friend's Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Handle or Phone (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. rahul_s"
              value={friendHandle}
              onChange={(e) => setFriendHandle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl font-medium"
            />
          </div>

          <div className="pt-2 border-t border-[var(--color-border)] flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md"
            >
              Save Friend
            </button>
          </div>
        </form>
      </Modal>

      {/* Friend Detail Sheet / Modal */}
      {selectedFriend && selectedFriendBreakdown && (
        <Modal
          isOpen={Boolean(selectedFriend)}
          onClose={() => setSelectedFriend(null)}
          title={selectedFriend.name}
          maxWidth="max-w-xl"
        >
          <div className="space-y-5 text-sm">
            {/* Header summary */}
            <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs text-[var(--color-text-muted)]">Net Balance</span>
                <div className="mt-0.5">
                  <MoneyDisplay
                    minor={selectedFriendBreakdown.netMinor}
                    currency={BASE_CURRENCY}
                    size="xl"
                    showSign={true}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSettleFriendId(selectedFriend.id)
                    setSettleAmountMinor(selectedFriendBreakdown.netMinor)
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all"
                >
                  Settle Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedFriend.id
                    setSelectedFriend(null)
                    onNavigateToStatement(id)
                  }}
                  className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] font-semibold rounded-xl text-xs transition-colors"
                >
                  Statement
                </button>
              </div>
            </div>

            {/* Source Chips */}
            <div>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                Breakdown by Group:
              </span>
              <SourceChips
                slices={selectedFriendBreakdown.slices}
                groups={ledgerState.groups}
              />
            </div>

            {/* Mutual Transactions list */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Shared Transactions ({mutualTransactions.length})
              </h4>
              {mutualTransactions.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] italic">No transactions with this friend yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {mutualTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{tx.emoji}</span>
                        <div>
                          <p className="font-semibold text-xs text-[var(--color-text)]">{tx.title}</p>
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {tx.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <MoneyDisplay
                          minor={tx.totalMinor}
                          currency={tx.currency}
                          size="sm"
                          showSign={false}
                          showColor={false}
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

      {/* Settle Up Trigger Modal */}
      {settleFriendId && (
        <SettleUpModal
          isOpen={Boolean(settleFriendId)}
          onClose={() => setSettleFriendId(null)}
          initialFriendId={settleFriendId}
          initialAmountMinor={settleAmountMinor}
        />
      )}
    </div>
  )
}

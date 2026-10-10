import React, { useState } from 'react'
import { Modal } from '../../ui/components/Modal'
import { Icon } from '../../ui/components/Icon'
import {
  isContactPickerSupported,
  matchContactsAgainstDirectory,
  type MatchedFriend,
  type UnmatchedContact,
  type ContactCandidate,
} from '../../services/contacts/contactMatchingService'
import { normalizeToE164 } from '../../domain/phone'
import { useStore } from '../../ui/storeContext'

interface ContactSyncModalProps {
  isOpen: boolean
  onClose: () => void
  onAddManualFriend?: (name: string, phone: string) => void
}

export const ContactSyncModal: React.FC<ContactSyncModalProps> = ({
  isOpen,
  onClose,
  onAddManualFriend,
}) => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''

  const supported = isContactPickerSupported()
  const [hasConsented, setHasConsented] = useState(false)
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<MatchedFriend[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedContact[]>([])
  const [hasScanned, setHasScanned] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Manual fallback inputs
  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualMsg, setManualMsg] = useState<string | null>(null)

  const inviteCode = me?.inviteCode || `sp_${meId.slice(-6).toLowerCase()}`
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://splitpay.app'
  const shareableInviteUrl = `${appOrigin}?invite=${encodeURIComponent(inviteCode)}`

  const handleCopyInviteLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareableInviteUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  const handleShareInvite = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'SplitPay - Split Expenses with Friends',
          text: `Hey! I'm using SplitPay to track and split shared expenses. Join my ledger circle:`,
          url: shareableInviteUrl,
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          handleCopyInviteLink()
        }
      }
    } else {
      handleCopyInviteLink()
    }
  }

  const handleTriggerContactPicker = async () => {
    setErrorMsg(null)
    setLoading(true)

    try {
      // TypeScript contact picker definition
      type ContactProperty = 'name' | 'tel'
      interface ContactPickerSelect {
        select: (props: ContactProperty[], options?: { multiple?: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>>
      }

      const navWithContacts = navigator as unknown as { contacts: ContactPickerSelect }
      const contacts = await navWithContacts.contacts.select(['name', 'tel'], { multiple: true })

      if (!contacts || contacts.length === 0) {
        setLoading(false)
        return
      }

      const candidates: ContactCandidate[] = contacts.map((c) => ({
        name: c.name?.[0],
        phones: c.tel || [],
      }))

      const existingFriendIds = ledgerState.people.filter((p) => p.id !== meId).map((p) => p.id)

      const result = matchContactsAgainstDirectory({
        candidates,
        directory: [...ledgerState.people],
        meId,
        existingFriendIds,
        inviteCode,
      })

      setMatches(result.matches)
      setUnmatched(result.unmatched)
      setHasScanned(true)
    } catch (err) {
      const errorObj = err as Error
      if (errorObj.name !== 'AbortError') {
        setErrorMsg(`Contact selection failed: ${errorObj.message || 'Unknown error'}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddMatchedFriend = async (friend: MatchedFriend) => {
    await store.addFriend(friend.name, friend.handle)
    // Update local state to reflect alreadyFriend
    setMatches((prev) =>
      prev.map((m) => (m.id === friend.id ? { ...m, alreadyFriend: true } : m))
    )
  }

  const handleManualAddFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setManualMsg(null)

    if (!manualName.trim() || !manualPhone.trim()) {
      setManualMsg('Please provide both a name and phone number.')
      return
    }

    const norm = normalizeToE164(manualPhone)
    if (!norm.valid) {
      setManualMsg(norm.error || 'Invalid phone number.')
      return
    }

    if (onAddManualFriend) {
      onAddManualFriend(manualName.trim(), norm.e164)
    } else {
      await store.addFriend(manualName.trim())
    }

    setManualName('')
    setManualPhone('')
    setManualMsg(`✓ Added ${manualName.trim()} to friends!`)
    setTimeout(() => setManualMsg(null), 3000)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Find Friends from Contacts" maxWidth="max-w-xl">
      <div className="space-y-4 text-sm">
        {/* Branch 1: Unsupported Browser Fallback (Desktop / iOS / non-compliant browser) */}
        {!supported ? (
          <div className="space-y-4">
            <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Icon name="smartphone" size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-[var(--color-text)]">
                  Device Address Book Sync
                </h4>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  The native Contact Picker API is supported on mobile browsers such as <strong>Chrome on Android</strong>. On this browser, you can add friends manually or share an instant invite link.
                </p>
              </div>
            </div>

            {/* Fallback 1: Shareable Invite Link */}
            <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-[var(--color-text)]">Share Your Invite Link</h4>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Friends who open your link will automatically connect with you.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary-subtle text-primary border border-primary-border">
                  {inviteCode}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareableInviteUrl}
                  className="flex-1 px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-mono text-[var(--color-text-muted)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleShareInvite}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                  <Icon name="share" size={14} />
                  <span>{copiedLink ? 'Copied Link!' : 'Share / Copy'}</span>
                </button>
              </div>
            </div>

            {/* Fallback 2: Manual Add by Phone */}
            <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-3">
              <h4 className="font-bold text-xs text-[var(--color-text)]">
                Add Friend by Phone Number
              </h4>
              <form onSubmit={handleManualAddFriendSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Friend's Name"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-medium focus:outline-none text-[var(--color-text)]"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-mono focus:outline-none text-[var(--color-text)]"
                  />
                </div>
                {manualMsg && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {manualMsg}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-xl transition-all"
                  >
                    Add Friend
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : !hasConsented && !hasScanned ? (
          /* Branch 2: Supported Mobile Browser Consent Screen */
          <div className="space-y-4 py-2">
            <div className="w-14 h-14 rounded-2xl hero-gradient text-white flex items-center justify-center mx-auto shadow-md">
              <Icon name="users" size={28} />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="font-extrabold text-base text-[var(--color-text)]">
                Privacy-First Contact Sync
              </h4>
              <p className="text-xs text-[var(--color-text-muted)] max-w-sm mx-auto leading-relaxed">
                SplitPay only checks your contacts against users who have explicitly verified their email, verified their phone, and opted into discoverability.
              </p>
            </div>

            <div className="p-3.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <Icon name="shield" size={16} />
                <span>Zero Unmatched Storage Invariant</span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                Unmatched contacts are processed strictly in browser memory for optional invite links and are <strong>never stored on any server or persistent ledger</strong>.
              </p>
            </div>

            <div className="pt-2 border-t border-[var(--color-border)] flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)]"
              >
                Not Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasConsented(true)
                  handleTriggerContactPicker()
                }}
                className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center gap-1.5 active:scale-95"
              >
                <Icon name="check" size={14} />
                <span>Select Contacts</span>
              </button>
            </div>
          </div>
        ) : (
          /* Branch 3: Results (Matches & Unmatched Invites) */
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium rounded-xl">
                {errorMsg}
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center space-y-3">
                <Icon name="reload" size={32} className="animate-spin text-primary mx-auto" />
                <p className="text-xs text-[var(--color-text-muted)]">
                  Comparing contacts against verified directory...
                </p>
              </div>
            ) : (
              <>
                {/* Matches Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                      Registered Friends Found ({matches.length})
                    </h4>
                    <button
                      type="button"
                      onClick={handleTriggerContactPicker}
                      className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Icon name="reload" size={12} />
                      <span>Scan Again</span>
                    </button>
                  </div>

                  {matches.length === 0 ? (
                    <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl text-center text-xs text-[var(--color-text-muted)]">
                      No contacts from your selection are currently registered and discoverable on SplitPay.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--color-border)] bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                      {matches.map((friend) => (
                        <div
                          key={friend.id}
                          className="p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-[var(--color-text)]">{friend.name}</p>
                            <p className="text-[11px] text-[var(--color-text-muted)]">
                              {friend.handle ? `@${friend.handle} · ` : ''}{friend.phoneDisplay}
                            </p>
                          </div>
                          <div>
                            {friend.alreadyFriend ? (
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                In Circle
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddMatchedFriend(friend)}
                                className="px-3 py-1 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                              >
                                Add Friend
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unmatched Invites Section */}
                {unmatched.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                      Invite to SplitPay ({unmatched.length})
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Send a personal WhatsApp message with your invite code.
                    </p>

                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {unmatched.map((contact, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="overflow-hidden pr-2">
                            <p className="font-semibold text-[var(--color-text)] truncate">{contact.name}</p>
                            <p className="text-[11px] text-[var(--color-text-muted)] font-mono">{contact.e164}</p>
                          </div>
                          <a
                            href={contact.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all inline-flex items-center gap-1 shrink-0"
                          >
                            <Icon name="send" size={12} />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-[var(--color-border)] flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)]"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

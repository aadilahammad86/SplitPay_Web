import React, { useState } from 'react'
import { Modal } from '../../ui/components/Modal'
import { Icon } from '../../ui/components/Icon'
import { Select } from '../../ui/components/Select'
import {
  isContactPickerSupported,
  matchContactsAgainstDirectory,
  lookupPersonByPhone,
  type MatchedFriend,
  type UnmatchedContact,
  type ContactCandidate,
} from '../../services/contacts/contactMatchingService'
import { formatE164Display } from '../../domain/phone'
import { useStore } from '../../ui/storeContext'

export interface ContactSyncContentProps {
  onFriendAdded?: (friend: MatchedFriend) => void
}

export interface ContactSyncModalProps {
  isOpen: boolean
  onClose: () => void
  onFriendAdded?: (friend: MatchedFriend) => void
}

const COUNTRY_CODES = [
  { code: '+91', label: 'India (+91)' },
  { code: '+1', label: 'United States (+1)' },
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+65', label: 'Singapore (+65)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+49', label: 'Germany (+49)' },
]

export const ContactSyncContent: React.FC<ContactSyncContentProps> = ({
  onFriendAdded,
}) => {
  const { store, ledgerState } = useStore()
  const me = store.me
  const meId = me?.id || ''

  const supported = isContactPickerSupported()
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<MatchedFriend[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedContact[]>([])
  const [hasScanned, setHasScanned] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const myPhone = me?.phone
  const initialCountryPrefix = React.useMemo(() => {
    if (myPhone) {
      const match = COUNTRY_CODES.find((c) => myPhone.startsWith(c.code))
      if (match) return match.code
    }
    return '+91'
  }, [myPhone])

  const [countryPrefix, setCountryPrefix] = useState(initialCountryPrefix)

  // Phone search state
  const [phoneSearchQuery, setPhoneSearchQuery] = useState('')
  const [searchingPhone, setSearchingPhone] = useState(false)
  const [searchResult, setSearchResult] = useState<{
    searched: boolean
    match?: MatchedFriend
    e164?: string
    whatsappInviteUrl?: string
    error?: string
  } | null>(null)

  const inviteCode = me?.inviteCode || `sp_${meId.slice(-6).toLowerCase()}`
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://splitpay.app'
  const shareableInviteUrl = `${appOrigin}?invite=${encodeURIComponent(inviteCode)}&name=${encodeURIComponent(me?.name || 'Friend')}&uid=${encodeURIComponent(meId)}`

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

  const handleSearchPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneSearchQuery.trim()) return

    setSearchingPhone(true)
    const existingFriendIds = ledgerState.people.filter((p) => p.id !== meId).map((p) => p.id)

    const res = await lookupPersonByPhone({
      phoneInput: phoneSearchQuery.trim(),
      localDirectory: [...ledgerState.people],
      meId,
      existingFriendIds,
      defaultCountryPrefix: countryPrefix,
      inviteCode,
    })

    setSearchingPhone(false)
    setSearchResult({
      searched: true,
      match: res.match,
      e164: res.e164,
      whatsappInviteUrl: res.whatsappInviteUrl,
      error: res.error,
    })
  }

  const handleTriggerContactPicker = async () => {
    setErrorMsg(null)
    setLoading(true)

    try {
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
        defaultCountryPrefix: countryPrefix,
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
    await store.addFriend(friend.name, friend.handle, {
      id: friend.id,
      phone: friend.phoneDisplay,
      phoneVerified: true,
    })
    setMatches((prev) =>
      prev.map((m) => (m.id === friend.id ? { ...m, alreadyFriend: true } : m))
    )
    if (searchResult?.match?.id === friend.id) {
      setSearchResult((prev) => prev ? { ...prev, match: { ...prev.match!, alreadyFriend: true } } : null)
    }
    onFriendAdded?.(friend)
  }

  return (
    <div className="space-y-4 text-sm">
        {/* Search by Phone Number across Database */}
        <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-3">
          <div>
            <h4 className="font-bold text-xs text-[var(--color-text)]">
              Find Friend by Mobile Number
            </h4>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Enter a friend's phone number to check if they're registered on SplitPay.
            </p>
          </div>

          <form onSubmit={handleSearchPhone} className="flex flex-col sm:flex-row gap-2">
            <div className="w-full sm:w-40 shrink-0">
              <Select
                value={countryPrefix}
                onChange={(val) => setCountryPrefix(val)}
                options={COUNTRY_CODES.map((c) => ({
                  value: c.code,
                  label: c.label,
                }))}
                ariaLabel="Country code for phone search"
              />
            </div>
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-[var(--color-text-muted)]">
                <Icon name="phone" size={14} />
              </span>
              <input
                type="tel"
                placeholder="Mobile number (e.g. 501234567)..."
                value={phoneSearchQuery}
                onChange={(e) => setPhoneSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-mono text-[var(--color-text)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={searchingPhone || !phoneSearchQuery.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0 inline-flex items-center justify-center gap-1.5"
            >
              {searchingPhone ? <Icon name="reload" size={13} className="animate-spin" /> : <Icon name="users" size={13} />}
              <span>Search</span>
            </button>
          </form>

          {/* Search Results */}
          {searchResult?.searched && (
            <div className="pt-2 animate-fade-in">
              {searchResult.error ? (
                <p className="text-xs text-rose-500 font-medium">{searchResult.error}</p>
              ) : searchResult.match ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                      {searchResult.match.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <h5 className="font-bold text-xs text-[var(--color-text)] truncate">
                        {searchResult.match.name}
                      </h5>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate font-mono">
                        {searchResult.match.handle ? `@${searchResult.match.handle} · ` : ''}
                        {searchResult.match.phoneDisplay}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={searchResult.match.alreadyFriend}
                    onClick={() => handleAddMatchedFriend(searchResult.match!)}
                    className="px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-lg shadow-sm hover:bg-primary-hover disabled:opacity-50 shrink-0 inline-flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Icon name={searchResult.match.alreadyFriend ? 'check' : 'plus'} size={12} />
                    <span>{searchResult.match.alreadyFriend ? 'Friend' : 'Add Friend'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-[var(--color-text)] block">
                      Not registered yet
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                      {searchResult.e164 ? formatE164Display(searchResult.e164) : phoneSearchQuery}
                    </span>
                  </div>

                  {searchResult.whatsappInviteUrl && (
                    <a
                      href={searchResult.whatsappInviteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer self-start sm:self-auto"
                    >
                      <span>Invite via WhatsApp</span>
                      <Icon name="share" size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Device Address Book Picker (Mobile Chrome) */}
        {supported && (
          <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-[var(--color-text)]">
                  Import from Phone Address Book
                </h4>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Pick contacts directly from your phone to find friends in bulk.
                </p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleTriggerContactPicker}
                className="px-3.5 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                {loading ? <Icon name="reload" size={13} className="animate-spin" /> : <Icon name="users" size={13} />}
                <span>Pick Contacts</span>
              </button>
            </div>

            {/* Scanned Matches List */}
            {hasScanned && (
              <div className="space-y-3 pt-2 border-t border-[var(--color-border)] animate-fade-in">
                {matches.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                      Registered Friends ({matches.length})
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {matches.map((friend) => (
                        <div
                          key={friend.id}
                          className="p-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-xs text-[var(--color-text)]">{friend.name}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{friend.phoneDisplay}</p>
                          </div>
                          <button
                            type="button"
                            disabled={friend.alreadyFriend}
                            onClick={() => handleAddMatchedFriend(friend)}
                            className="px-3 py-1 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-lg disabled:opacity-50 transition-all cursor-pointer"
                          >
                            {friend.alreadyFriend ? 'Added' : 'Add Friend'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {unmatched.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                      Invite to SplitPay ({unmatched.length})
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {unmatched.map((u, i) => (
                        <div
                          key={`${u.e164}-${i}`}
                          className="p-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-xs text-[var(--color-text)]">{u.name}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] font-mono">{formatE164Display(u.e164)}</p>
                          </div>
                          <a
                            href={u.whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-press px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all cursor-pointer"
                          >
                            Invite
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Shareable Invite Link Card */}
        <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-[var(--color-text)]">Share Your Invite Link</h4>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary-subtle text-primary border border-primary-border">
              {inviteCode}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareableInviteUrl}
              className="flex-1 px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-mono text-[var(--color-text-muted)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleShareInvite}
              className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0"
            >
              <Icon name="share" size={13} />
              <span>{copiedLink ? 'Copied!' : 'Share Link'}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 text-xs rounded-xl">
            {errorMsg}
          </div>
        )}
      </div>
  )
}

export const ContactSyncModal: React.FC<ContactSyncModalProps> = ({
  isOpen,
  onClose,
  onFriendAdded,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Find Friends & Contacts" maxWidth="max-w-xl">
      <ContactSyncContent onFriendAdded={onFriendAdded} />
    </Modal>
  )
}


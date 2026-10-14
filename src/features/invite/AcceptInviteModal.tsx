import React, { useEffect, useState } from 'react'
import { Modal } from '../../ui/components/Modal'
import { Icon } from '../../ui/components/Icon'
import { useStore } from '../../ui/storeContext'
import { getSupabaseClient } from '../../supabase/supabaseClient'
import { formatE164Display } from '../../domain/phone'

interface InviterInfo {
  id: string
  name: string
  handle?: string
  phone?: string
  inviteCode: string
}

interface AcceptInviteModalProps {
  onNavigate?: (tab: string) => void
}

function getInitialInviteParam(): { inviteCode: string | null; nameParam: string | null; uidParam: string | null } {
  if (typeof window === 'undefined') return { inviteCode: null, nameParam: null, uidParam: null }
  try {
    const searchParams = new URLSearchParams(window.location.search)
    let inviteCode = searchParams.get('invite')
    const nameParam = searchParams.get('name')
    const uidParam = searchParams.get('uid')

    if (!inviteCode && window.location.hash) {
      const hashMatch = window.location.hash.match(/invite[=/]([a-zA-Z0-9_-]+)/)
      if (hashMatch) {
        inviteCode = hashMatch[1]
      }
    }
    return { inviteCode, nameParam, uidParam }
  } catch {
    return { inviteCode: null, nameParam: null, uidParam: null }
  }
}

export const AcceptInviteModal: React.FC<AcceptInviteModalProps> = ({ onNavigate }) => {
  const { store, ledgerState } = useStore()
  const me = store.me

  const [initialParams] = useState(getInitialInviteParam)
  const isSelf = Boolean(
    (me?.inviteCode && initialParams.inviteCode && me.inviteCode.toLowerCase() === initialParams.inviteCode.toLowerCase()) ||
    (initialParams.uidParam && me?.id === initialParams.uidParam)
  )

  const [isOpen, setIsOpen] = useState(() => Boolean(initialParams.inviteCode && !isSelf))
  const [loading, setLoading] = useState(() => Boolean(initialParams.inviteCode && !isSelf))
  const [submitting, setSubmitting] = useState(false)
  const [inviter, setInviter] = useState<InviterInfo | null>(null)
  const [alreadyFriend, setAlreadyFriend] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const cleanUrlInviteParams = () => {
    if (typeof window === 'undefined') return
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('invite')
      url.searchParams.delete('name')
      url.searchParams.delete('uid')

      // Clean hash if formatted like #/invite/xyz or #invite=xyz
      if (url.hash.includes('invite')) {
        url.hash = ''
      }

      window.history.replaceState({}, document.title, url.toString())
    } catch {
      // ignore URL manipulation error
    }
  }

  useEffect(() => {
    if (!initialParams.inviteCode || isSelf) {
      if (isSelf) cleanUrlInviteParams()
      return
    }

    async function resolveInviter() {
      const code = initialParams.inviteCode!
      const uidParam = initialParams.uidParam
      const nameParam = initialParams.nameParam
      let resolved: InviterInfo | null = null

      // Check local directory first
      const localPerson = ledgerState.people.find(
        (p) =>
          (p.inviteCode && p.inviteCode.toLowerCase() === code.toLowerCase()) ||
          (uidParam && p.id === uidParam)
      )

      if (localPerson && localPerson.id !== me?.id) {
        resolved = {
          id: localPerson.id,
          name: localPerson.name,
          handle: localPerson.handle,
          phone: localPerson.phone,
          inviteCode: code,
        }
      }

      // Check live Supabase database
      if (!resolved) {
        try {
          const supabase = getSupabaseClient()
          if (supabase) {
            // Lookup by invite_code
            const { data, error } = await supabase
              .from('profiles')
              .select('id, name, handle, phone, invite_code')
              .eq('invite_code', code)
              .maybeSingle()

            if (!error && data && data.id !== me?.id) {
              resolved = {
                id: data.id,
                name: data.name,
                handle: data.handle || undefined,
                phone: data.phone || undefined,
                inviteCode: data.invite_code || code,
              }
            } else if (uidParam) {
              // Fallback query by ID
              const { data: uidData } = await supabase
                .from('profiles')
                .select('id, name, handle, phone, invite_code')
                .eq('id', uidParam)
                .maybeSingle()

              if (uidData && uidData.id !== me?.id) {
                resolved = {
                  id: uidData.id,
                  name: uidData.name,
                  handle: uidData.handle || undefined,
                  phone: uidData.phone || undefined,
                  inviteCode: uidData.invite_code || code,
                }
              }
            }
          }
        } catch (err) {
          console.warn('Supabase invite lookup warning:', err)
        }
      }

      // Fallback: use query param metadata if profile wasn't found in DB
      if (!resolved && (nameParam || uidParam)) {
        resolved = {
          id: uidParam || `invited_${code}`,
          name: nameParam ? decodeURIComponent(nameParam) : 'Invited Friend',
          inviteCode: code,
        }
      }

      if (!resolved) {
        setStatusMessage('Invite code could not be found or has expired.')
        setLoading(false)
        return
      }

      const isAlreadyFriend = ledgerState.people.some(
        (p) => p.id === resolved!.id || (resolved!.phone && p.phone === resolved!.phone)
      )

      setInviter(resolved)
      setAlreadyFriend(isAlreadyFriend)
      setLoading(false)
    }

    resolveInviter()
  }, [initialParams, isSelf, ledgerState.people, me?.id])

  const handleAcceptInvite = async () => {
    if (!inviter) return
    setSubmitting(true)
    try {
      await store.addFriend(inviter.name, inviter.handle, {
        id: inviter.id,
        phone: inviter.phone,
        phoneVerified: !!inviter.phone,
        inviteCode: inviter.inviteCode,
      })
      setStatusMessage(`Connected! ${inviter.name} has been added to your friends.`)
      setAlreadyFriend(true)
      cleanUrlInviteParams()

      setTimeout(() => {
        setIsOpen(false)
        if (onNavigate) onNavigate('friends')
      }, 1200)
    } catch (err) {
      console.error('Failed to accept invite:', err)
      setStatusMessage('Failed to connect. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    cleanUrlInviteParams()
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Connect on SplitPay">
      <div className="space-y-5 text-sm py-1 animate-fade-in">
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary-subtle text-primary border border-primary-border flex items-center justify-center">
              <Icon name="reload" size={24} className="animate-spin" />
            </div>
            <p className="text-xs text-[var(--color-text-muted)] font-medium">
              Resolving invite details...
            </p>
          </div>
        ) : inviter ? (
          <>
            {/* Inviter Presentation Header */}
            <div className="p-4 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-extrabold text-lg shadow-sm shrink-0">
                {inviter.name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden flex-1">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                  Friend Invitation
                </span>
                <h3 className="font-extrabold text-base text-[var(--color-text)] truncate">
                  {inviter.name}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] truncate font-mono">
                  {inviter.handle ? `@${inviter.handle} ` : ''}
                  {inviter.phone ? `· ${formatE164Display(inviter.phone)}` : ''}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              <strong>{inviter.name}</strong> invited you to connect on SplitPay to share expenses,
              track balances, and easily settle payments together.
            </p>

            {statusMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Icon name="check" size={15} />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-2">
              {alreadyFriend ? (
                <button
                  type="button"
                  onClick={() => {
                    handleClose()
                    if (onNavigate) onNavigate('friends')
                  }}
                  className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <Icon name="users" size={14} />
                  <span>View in Friends</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-2.5 px-4 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-semibold rounded-xl transition-all"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleAcceptInvite}
                    className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-1.5"
                  >
                    {submitting ? (
                      <Icon name="reload" size={14} className="animate-spin" />
                    ) : (
                      <Icon name="check" size={14} />
                    )}
                    <span>Accept & Add Friend</span>
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="py-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto">
              <Icon name="close" size={20} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[var(--color-text)]">Invite Not Found</h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {statusMessage || 'This invite link is invalid or may have expired.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="py-2.5 px-6 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] text-[var(--color-text)] font-semibold text-xs rounded-xl transition-all"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

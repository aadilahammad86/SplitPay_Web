import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: React.ReactNode
  children: React.ReactNode
  maxWidth?: string
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}) => {
  const [mounted, setMounted] = useState(isOpen)
  const [isClosing, setIsClosing] = useState(false)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)

  // Cache title and children while open so if parent clears props or state on close,
  // the closing animation displays the full modal content rather than an empty box
  const [cachedChildren, setCachedChildren] = useState(children)
  const [cachedTitle, setCachedTitle] = useState(title)

  // Adjust state during render when isOpen prop changes (React recommended pattern)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setMounted(true)
      setIsClosing(false)
      setCachedChildren(children)
      setCachedTitle(title)
    } else if (mounted) {
      setIsClosing(true)
    }
  } else if (isOpen && (cachedChildren !== children || cachedTitle !== title)) {
    setCachedChildren(children)
    setCachedTitle(title)
  }

  // Handle closing timer when isClosing becomes true
  useEffect(() => {
    if (isClosing) {
      const timer = setTimeout(() => {
        setMounted(false)
        setIsClosing(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isClosing])

  // Central close handler that triggers exit animation and notifies parent
  const handleRequestClose = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    onClose()
  }, [isClosing, onClose])

  // Lock background scroll when modal is open and handle Escape key
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return

    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    const originalTouchAction = document.body.style.touchAction

    // Compensate for desktop scrollbar disappearance to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleRequestClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
      document.body.style.touchAction = originalTouchAction
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleRequestClose])

  if (!mounted || typeof document === 'undefined') return null

  const displayTitle = isOpen ? title : (cachedTitle || title)
  const displayChildren = isOpen ? children : (cachedChildren || children)

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto overscroll-contain ${
        isClosing ? 'pointer-events-none' : ''
      }`}
      style={{ minHeight: '100dvh' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Full viewport edge-to-edge backdrop with smooth blur */}
      <div
        className={`fixed inset-0 w-screen h-screen min-h-[100dvh] bg-black/60 backdrop-blur-md ${
          isClosing ? 'animate-modal-backdrop-exit' : 'animate-modal-backdrop'
        }`}
        onClick={handleRequestClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card - centered in viewport, fully responsive */}
      <div
        className={`relative w-full ${maxWidth} my-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88dvh] sm:max-h-[90dvh] z-10 ${
          isClosing ? 'animate-modal-pop-exit' : 'animate-modal-pop'
        }`}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
          <h2 id="modal-title" className="text-base sm:text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
            {displayTitle}
          </h2>
          <button
            type="button"
            onClick={handleRequestClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)] active:scale-95 transition-all text-sm cursor-pointer"
            aria-label="Close dialog"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain">{displayChildren}</div>
      </div>
    </div>,
    document.body
  )
}

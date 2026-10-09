import React, { useState, useRef, useEffect } from 'react'
import { Icon } from './Icon'

export interface SelectOption<T = string> {
  value: T
  label: React.ReactNode
  sublabel?: string
  icon?: React.ReactNode
}

interface SelectProps<T = string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  className?: string
  buttonClassName?: string
  menuClassName?: string
  ariaLabel?: string
}

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  ariaLabel,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [openUpward, setOpenUpward] = useState(false)

  const selectedOption = options.find((opt) => opt.value === value)

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Determine if dropdown should open upward when near bottom of viewport
  const toggleOpen = () => {
    if (disabled) return
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      // If less than 220px below and more space above, open upward
      setOpenUpward(spaceBelow < 220 && rect.top > 220)
    }
    setIsOpen((prev) => !prev)
  }

  const handleSelect = (optValue: T) => {
    onChange(optValue)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button - identical look on iOS, Android, Desktop */}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`w-full px-3.5 py-2.5 bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)]/20 border border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl font-bold text-xs sm:text-sm text-[var(--color-text)] flex items-center justify-between gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span className="truncate flex items-center gap-2">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <Icon
          name="chevronDown"
          size={14}
          className={`text-[var(--color-text-muted)] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Menu - identical theme styling across all OS */}
      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } w-full min-w-[10rem] z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl py-1.5 max-h-56 overflow-y-auto overscroll-contain animate-modal-pop ${menuClassName}`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3.5 py-2.5 text-left text-xs sm:text-sm flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-primary-subtle text-primary font-bold'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)] font-medium'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <div className="truncate">
                    <div className="truncate">{opt.label}</div>
                    {opt.sublabel && (
                      <div className="text-[10px] text-[var(--color-text-muted)] font-normal truncate">
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <Icon name="check" size={14} className="text-primary shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

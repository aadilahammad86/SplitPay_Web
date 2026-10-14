import React from 'react'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  ariaLabel?: string
  id?: string
  name?: string
  className?: string
}

/**
 * SplitPay Switch Component
 * Accessible, animated toggle switch following WCAG and modern design guidelines.
 * Features smooth spring animation, high contrast dark/light states, and active theme coloring.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  ariaLabel,
  id,
  name,
  className = '',
}) => {
  const isSm = size === 'sm'

  return (
    <button
      type="button"
      role="switch"
      id={id}
      name={name}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange(!checked)
        }
      }}
      className={`
        relative inline-flex items-center shrink-0 cursor-pointer rounded-full p-[2px]
        transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]
        disabled:opacity-40 disabled:cursor-not-allowed
        active:scale-[0.96]
        ${isSm ? 'w-9 h-5' : 'w-11 h-6'}
        ${
          checked
            ? 'bg-primary shadow-[0_0_12px_var(--color-primary-glow)] border border-transparent'
            : 'bg-slate-300 dark:bg-slate-700/90 border border-slate-400/50 dark:border-white/10'
        }
        ${className}
      `.trim()}
    >
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block rounded-full bg-white shadow-md transform
          transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${isSm ? 'w-4 h-4' : 'w-5 h-5'}
          ${
            isSm
              ? checked
                ? 'translate-x-4'
                : 'translate-x-0'
              : checked
                ? 'translate-x-5'
                : 'translate-x-0'
          }
        `}
      />
    </button>
  )
}

import React from 'react'

interface SkeletonProps {
  /** Tailwind sizing/shape classes, e.g. "h-8 w-32" or "h-10 w-10 rounded-full" */
  className?: string
}

/**
 * Skeleton placeholder for loading states.
 * Pure CSS pulse — zero JS, zero runtime cost.
 *
 * Usage:
 *   <Skeleton className="h-8 w-32" />        // money amount
 *   <Skeleton className="h-4 w-48" />        // text line
 *   <Skeleton className="h-10 w-10 rounded-xl" /> // avatar
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div
    className={`animate-pulse rounded-lg bg-[var(--color-surface-raised,var(--color-surface-subtle))] ${className}`}
    role="presentation"
    aria-hidden="true"
  />
)

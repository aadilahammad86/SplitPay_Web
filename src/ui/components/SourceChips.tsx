import React from 'react'
import type { BalanceSlice } from '../../domain/balance'
import type { Group } from '../../domain/entities'
import { GroupKindInfo } from '../../domain/entities'
import { MoneyDisplay } from './MoneyDisplay'
import { BASE_CURRENCY } from '../../domain/entities'
import { CategoryIcon } from './Icon'

interface SourceChipsProps {
  slices: readonly BalanceSlice[]
  groups: readonly Group[]
  defaultCurrency?: import('../../domain/money').CurrencyCode
  onSelectGroup?: (groupId: string | null) => void
}

export const SourceChips: React.FC<SourceChipsProps> = ({
  slices,
  groups,
  defaultCurrency,
  onSelectGroup,
}) => {
  if (slices.length === 0) return null

  const groupMap = new Map(groups.map((g) => [g.id, g]))

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {slices.map((slice) => {
        const group = slice.groupId ? groupMap.get(slice.groupId) : null
        const emoji = group ? GroupKindInfo[group.kind].emoji : '👤'
        const label = group ? group.name : 'Direct'
        const currency = group ? group.currency : (defaultCurrency || BASE_CURRENCY)

        return (
          <button
            key={slice.groupId ?? 'direct'}
            type="button"
            onClick={() => onSelectGroup?.(slice.groupId)}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
              slice.amountMinor > 0
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-800 dark:text-rose-300'
            }`}
          >
            <CategoryIcon category={emoji} size={13} />
            <span>{label}:</span>
            <MoneyDisplay
              minor={slice.amountMinor}
              currency={currency}
              size="sm"
              showSign={true}
              showColor={false}
            />
          </button>
        )
      })}
    </div>
  )
}

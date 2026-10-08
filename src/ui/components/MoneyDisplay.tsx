import React from 'react'
import { Money, type CurrencyCode } from '../../domain/money'

interface MoneyDisplayProps {
  minor: number
  currency: CurrencyCode
  showSign?: boolean
  showColor?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  minor,
  currency,
  showSign = true,
  showColor = true,
  className = '',
  size = 'md',
}) => {
  const money = new Money(Math.abs(minor), currency)
  const isPositive = minor > 0
  const isNegative = minor < 0

  let colorClass = ''
  if (showColor) {
    if (isPositive) colorClass = 'text-positive'
    else if (isNegative) colorClass = 'text-negative'
    else colorClass = 'text-muted'
  }

  let signStr = ''
  if (showSign) {
    if (isPositive) signStr = '+'
    else if (isNegative) signStr = '-'
  }

  const sizeStyles: Record<string, string> = {
    sm: 'text-sm font-medium',
    md: 'text-base font-semibold',
    lg: 'text-xl font-bold',
    xl: 'text-3xl font-extrabold tracking-tight',
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${sizeStyles[size]} ${colorClass} ${className}`}
      aria-label={`${isPositive ? 'positive' : isNegative ? 'negative' : ''} ${money.spoken()}`}
    >
      {signStr && <span className="font-bold">{signStr}</span>}
      <span>{currency.symbol}</span>
      <span>{money.plain()}</span>
    </span>
  )
}

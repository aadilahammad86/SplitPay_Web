import React from 'react'
import { Money, Currencies, type CurrencyCode } from '../../domain/money'

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
  const safeMinor = typeof minor === 'number' && Number.isInteger(minor) ? minor : 0
  const safeCurrency = currency || Currencies.INR
  const money = new Money(Math.abs(safeMinor), safeCurrency)
  const isPositive = safeMinor > 0
  const isNegative = safeMinor < 0

  let colorClass = ''
  if (showColor) {
    if (isPositive) colorClass = 'text-owed'
    else if (isNegative) colorClass = 'text-owe'
    else colorClass = 'text-settled'
  }

  let signStr = ''
  if (showSign) {
    if (isPositive) signStr = '+'
    else if (isNegative) signStr = '\u2212' // proper minus sign
  }

  const sizeStyles: Record<string, string> = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-semibold',
    lg: 'text-xl font-bold',
    xl: 'text-3xl font-extrabold tracking-tight',
  }

  return (
    <span
      className={`font-money inline-flex items-center gap-0.5 ${sizeStyles[size]} ${colorClass} ${className}`}
      aria-label={`${isPositive ? 'positive' : isNegative ? 'negative' : ''} ${money.spoken()}`}
    >
      {signStr && <span className="font-bold">{signStr}</span>}
      <span>{safeCurrency.symbol}</span>
      <span>{money.plain()}</span>
    </span>
  )
}

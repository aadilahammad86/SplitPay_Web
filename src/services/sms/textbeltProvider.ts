import type { SmsProvider, SendSmsResult } from './smsProvider'

export interface TextbeltConfig {
  key?: string // Defaults to 'textbelt' (free 1 SMS per day)
}

/**
 * Textbelt Free SMS Provider
 * Sends real carrier SMS.
 * Free tier: 1 free SMS per day per IP address with no sign-up or credit card required.
 */
export class TextbeltProvider implements SmsProvider {
  readonly id = 'textbelt'
  readonly name = 'Textbelt Free SMS (1 Real SMS/day)'

  private config: TextbeltConfig

  constructor(config: TextbeltConfig = { key: 'textbelt' }) {
    this.config = config
  }

  updateConfig(config: TextbeltConfig): void {
    this.config = config
  }

  async sendOtp(phoneE164: string, otp: string): Promise<SendSmsResult> {
    const key = (this.config.key && this.config.key.trim()) || 'textbelt'
    const message = `SplitPay OTP: ${otp}. Valid for 10 mins.`

    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const targetUrl = isDev ? '/api/textbelt/text' : 'https://textbelt.com/text'

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneE164,
          message,
          key,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Textbelt daily free SMS quota exceeded (1 SMS/day per IP).',
        }
      }

      return {
        success: true,
        messageId: data.textId ? String(data.textId) : `textbelt_${Date.now()}`,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to reach Textbelt SMS gateway.',
      }
    }
  }
}

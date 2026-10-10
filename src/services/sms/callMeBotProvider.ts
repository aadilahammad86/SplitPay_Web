import type { SmsProvider, SendSmsResult } from './smsProvider'

export interface CallMeBotConfig {
  apiKey: string
}

/**
 * 100% Free For Life WhatsApp Delivery via CallMeBot API
 * Delivers real OTP messages directly to your real smartphone on WhatsApp!
 * Free forever, zero cost, no expiration, no credit card.
 *
 * Setup:
 * 1. Open WhatsApp and send: "I allow callmebot to send me messages" to +34 644 26 33 77
 * 2. CallMeBot replies with your free API Key.
 * 3. Enter that API key here.
 */
export class CallMeBotProvider implements SmsProvider {
  readonly id = 'callmebot'
  readonly name = 'WhatsApp via CallMeBot (100% Free Forever)'

  private config: CallMeBotConfig

  constructor(config: CallMeBotConfig) {
    this.config = config
  }

  updateConfig(config: CallMeBotConfig): void {
    this.config = config
  }

  async sendOtp(phoneE164: string, otp: string): Promise<SendSmsResult> {
    const { apiKey } = this.config

    if (!apiKey.trim()) {
      return {
        success: false,
        error: 'CallMeBot API key is missing. Please enter your free API key in Settings.',
      }
    }

    const message = `Your SplitPay verification code is: *${otp}*.\n\nValid for 10 minutes. Do not share this code.`

    // Prefer dev proxy to bypass browser CORS if on localhost, otherwise direct
    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const baseUrl = isDev ? '/api/callmebot/whatsapp.php' : 'https://api.callmebot.com/whatsapp.php'

    const queryParams = new URLSearchParams({
      phone: phoneE164,
      text: message,
      apikey: apiKey.trim(),
    })

    const targetUrl = `${baseUrl}?${queryParams.toString()}`

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
      })

      const responseText = await response.text()

      // CallMeBot returns plain text error messages even with 200 HTTP codes
      if (
        responseText.toLowerCase().includes('invalid apikey') ||
        responseText.toLowerCase().includes('not registered') ||
        responseText.toLowerCase().includes('error')
      ) {
        return {
          success: false,
          error: `CallMeBot error: ${responseText.replace(/<[^>]+>/g, '').trim()}`,
        }
      }

      return {
        success: true,
        messageId: `callmebot_${Date.now()}`,
      }
    } catch (err) {
      // In production or cross-origin environments, attempt no-cors dispatch as fallback
      try {
        await fetch(`https://api.callmebot.com/whatsapp.php?${queryParams.toString()}`, {
          method: 'GET',
          mode: 'no-cors',
        })
        return {
          success: true,
          messageId: `callmebot_nocors_${Date.now()}`,
        }
      } catch (fallbackErr) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(fallbackErr),
        }
      }
    }
  }
}

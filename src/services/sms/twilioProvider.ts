import type { SmsProvider, SendSmsResult } from './smsProvider'

export interface TwilioConfig {
  accountSid: string
  authToken: string
  fromNumber: string
}

/**
 * Twilio SMS Provider Adapter.
 * Connects to Twilio REST Messages API when production credentials are configured.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly id = 'twilio'
  readonly name = 'Twilio SMS'

  private config: TwilioConfig

  constructor(config: TwilioConfig) {
    this.config = config
  }

  async sendOtp(phoneE164: string, otp: string): Promise<SendSmsResult> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`
      const body = new URLSearchParams({
        To: phoneE164,
        From: this.config.fromNumber,
        Body: `Your SplitPay verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${this.config.accountSid}:${this.config.authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `Twilio delivery failed (${response.status}): ${errorText}`,
        }
      }

      const data = (await response.json()) as { sid?: string }
      return {
        success: true,
        messageId: data.sid,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}

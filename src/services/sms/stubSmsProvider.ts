import type { SmsProvider, SendSmsResult } from './smsProvider'

export interface DispatchedSms {
  id: string
  phoneE164: string
  otp: string
  timestamp: number
}

type SmsListener = (sms: DispatchedSms) => void

/**
 * Development & Testing SMS Provider.
 * Safely simulates SMS delivery in development and test environments
 * without hitting third-party paid APIs or sending real cellular traffic.
 */
export class StubSmsProvider implements SmsProvider {
  readonly id = 'stub'
  readonly name = 'Local Development (Simulator)'

  private dispatched: DispatchedSms[] = []
  private listeners = new Set<SmsListener>()

  async sendOtp(phoneE164: string, otp: string): Promise<SendSmsResult> {
    const item: DispatchedSms = {
      id: `stub_sms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      phoneE164,
      otp,
      timestamp: Date.now(),
    }

    this.dispatched.push(item)

    // Notify registered UI listeners (e.g. dev banner)
    for (const listener of this.listeners) {
      try {
        listener(item)
      } catch (err) {
        console.error('Stub SMS listener error:', err)
      }
    }

    return {
      success: true,
      messageId: item.id,
    }
  }

  subscribe(listener: SmsListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getLatestForPhone(phoneE164: string): DispatchedSms | undefined {
    return [...this.dispatched].reverse().find((s) => s.phoneE164 === phoneE164)
  }

  clearHistory(): void {
    this.dispatched = []
  }
}

export const defaultStubSmsProvider = new StubSmsProvider()

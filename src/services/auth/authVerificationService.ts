import {
  type OtpSession,
  generateSecureOtp,
  createOtpSession,
  verifyOtpCandidate,
  canResendOtp,
  type VerifyOtpResult,
} from '../../domain/otp'
import { normalizeToE164 } from '../../domain/phone'
import type { SmsProvider } from '../sms/smsProvider'
import { defaultStubSmsProvider } from '../sms/stubSmsProvider'
import { CallMeBotProvider } from '../sms/callMeBotProvider'
import { TextbeltProvider } from '../sms/textbeltProvider'
import { TwilioSmsProvider } from '../sms/twilioProvider'
import type { EmailProvider } from '../email/emailProvider'
import { defaultStubEmailProvider } from '../email/stubEmailProvider'
import { EmailJsProvider } from '../email/emailJsProvider'

export interface VerificationNotification {
  id: string
  type: 'email' | 'sms'
  target: string
  otp: string
  timestamp: number
  isRealDelivery?: boolean
}

type NotificationListener = (notice: VerificationNotification) => void

export class AuthVerificationService {
  private emailProvider: EmailProvider
  private smsProvider: SmsProvider
  private activeEmailSession: OtpSession | null = null
  private activePhoneSession: OtpSession | null = null
  private notificationListeners = new Set<NotificationListener>()
  private latestNotification: VerificationNotification | null = null

  constructor(
    smsProvider: SmsProvider = defaultStubSmsProvider,
    emailProvider: EmailProvider = defaultStubEmailProvider
  ) {
    this.smsProvider = smsProvider
    this.emailProvider = emailProvider
    this.initFromStorage()
  }

  /**
   * Initializes real configured providers from localStorage if available.
   */
  private initFromStorage(): void {
    if (typeof localStorage === 'undefined') return

    // Initialize Email Provider
    const envServiceId = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_EMAILJS_SERVICE_ID as string) : ''
    const envTemplateId = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string) : ''
    const envPublicKey = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string) : ''

    const emailProviderId = localStorage.getItem('splitpay_email_provider') || (envServiceId ? 'emailjs' : 'stub')
    if (emailProviderId === 'emailjs') {
      const serviceId = localStorage.getItem('splitpay_emailjs_service_id') || envServiceId || ''
      const templateId = localStorage.getItem('splitpay_emailjs_template_id') || envTemplateId || ''
      const publicKey = localStorage.getItem('splitpay_emailjs_public_key') || envPublicKey || ''
      if (serviceId && templateId && publicKey) {
        this.emailProvider = new EmailJsProvider({ serviceId, templateId, publicKey })
      }
    }

    // Initialize Phone / SMS Provider
    const smsProviderId = localStorage.getItem('splitpay_sms_provider') || 'stub'
    if (smsProviderId === 'callmebot') {
      const apiKey = localStorage.getItem('splitpay_callmebot_api_key') || ''
      this.smsProvider = new CallMeBotProvider({ apiKey })
    } else if (smsProviderId === 'textbelt') {
      const key = localStorage.getItem('splitpay_textbelt_key') || 'textbelt'
      this.smsProvider = new TextbeltProvider({ key })
    } else if (smsProviderId === 'twilio') {
      const accountSid = localStorage.getItem('splitpay_twilio_sid') || ''
      const authToken = localStorage.getItem('splitpay_twilio_token') || ''
      const fromNumber = localStorage.getItem('splitpay_twilio_from') || ''
      this.smsProvider = new TwilioSmsProvider({ accountSid, authToken, fromNumber })
    }
  }

  setEmailProvider(provider: EmailProvider): void {
    this.emailProvider = provider
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_email_provider', provider.id)
    }
  }

  getEmailProvider(): EmailProvider {
    return this.emailProvider
  }

  setSmsProvider(provider: SmsProvider): void {
    this.smsProvider = provider
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('splitpay_sms_provider', provider.id)
    }
  }

  getSmsProvider(): SmsProvider {
    return this.smsProvider
  }

  subscribeNotifications(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener)
    if (this.latestNotification) {
      listener(this.latestNotification)
    }
    return () => {
      this.notificationListeners.delete(listener)
    }
  }

  getLatestNotification(): VerificationNotification | null {
    return this.latestNotification
  }

  clearLatestNotification(): void {
    this.latestNotification = null
  }

  private dispatchNotification(notice: VerificationNotification): void {
    this.latestNotification = notice
    for (const l of this.notificationListeners) {
      try {
        l(notice)
      } catch (err) {
        console.error('Notification dispatch error:', err)
      }
    }
  }

  // ==========================================================================
  // EMAIL VERIFICATION FLOW
  // ==========================================================================

  async requestEmailOtp(email: string): Promise<{
    success: boolean
    cooldownSeconds?: number
    error?: string
    isRealDelivery?: boolean
  }> {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' }
    }

    if (this.activeEmailSession && this.activeEmailSession.target === cleanEmail) {
      const { allowed, remainingCooldownSeconds } = canResendOtp(this.activeEmailSession)
      if (!allowed) {
        return {
          success: false,
          cooldownSeconds: remainingCooldownSeconds,
          error: `Please wait ${remainingCooldownSeconds}s before requesting a new code.`,
        }
      }
    }

    const rawOtp = generateSecureOtp()
    this.activeEmailSession = await createOtpSession({
      id: `email_otp_${Date.now()}`,
      target: cleanEmail,
      otp: rawOtp,
      purpose: 'email_verification',
    })

    // Dispatch via configured Email Provider
    const isReal = this.emailProvider.id !== 'stub'
    const sendResult = await this.emailProvider.sendOtp(cleanEmail, rawOtp)

    if (!sendResult.success) {
      return {
        success: false,
        error: sendResult.error || 'Failed to send email OTP.',
      }
    }

    // Only broadcast in-app banner if on stub provider
    if (this.emailProvider.id === 'stub') {
      this.dispatchNotification({
        id: `notice_mail_${Date.now()}`,
        type: 'email',
        target: cleanEmail,
        otp: rawOtp,
        timestamp: Date.now(),
        isRealDelivery: false,
      })
    }

    return { success: true, isRealDelivery: isReal }
  }

  async verifyEmailOtp(candidate: string): Promise<VerifyOtpResult> {
    if (!this.activeEmailSession) {
      return { success: false, error: 'EXPIRED', remainingAttempts: 0 }
    }

    const result = await verifyOtpCandidate(this.activeEmailSession, candidate)
    return result
  }

  getActiveEmailSession(): OtpSession | null {
    return this.activeEmailSession
  }

  // ==========================================================================
  // PHONE LINKING FLOW
  // ==========================================================================

  async requestPhoneOtp(
    rawPhone: string,
    defaultCountryPrefix: string = '+91'
  ): Promise<{
    success: boolean
    e164?: string
    cooldownSeconds?: number
    error?: string
    isRealDelivery?: boolean
  }> {
    const normalized = normalizeToE164(rawPhone, defaultCountryPrefix)
    if (!normalized.valid) {
      return { success: false, error: normalized.error }
    }

    const e164 = normalized.e164

    if (this.activePhoneSession && this.activePhoneSession.target === e164) {
      const { allowed, remainingCooldownSeconds } = canResendOtp(this.activePhoneSession)
      if (!allowed) {
        return {
          success: false,
          e164,
          cooldownSeconds: remainingCooldownSeconds,
          error: `Please wait ${remainingCooldownSeconds}s before requesting another SMS.`,
        }
      }
    }

    const rawOtp = generateSecureOtp()
    this.activePhoneSession = await createOtpSession({
      id: `phone_otp_${Date.now()}`,
      target: e164,
      otp: rawOtp,
      purpose: 'phone_linking',
    })

    // Dispatch via configured Phone Provider (CallMeBot WhatsApp, Textbelt, Twilio, or Stub)
    const isReal = this.smsProvider.id !== 'stub'
    const sendResult = await this.smsProvider.sendOtp(e164, rawOtp)

    if (!sendResult.success) {
      return {
        success: false,
        error: sendResult.error || 'Failed to send phone OTP.',
      }
    }

    // Only dispatch dev notification banner if stub provider is active
    if (this.smsProvider.id === 'stub') {
      this.dispatchNotification({
        id: `notice_sms_${Date.now()}`,
        type: 'sms',
        target: e164,
        otp: rawOtp,
        timestamp: Date.now(),
        isRealDelivery: false,
      })
    }

    return { success: true, e164, isRealDelivery: isReal }
  }

  async verifyPhoneOtp(candidate: string): Promise<VerifyOtpResult> {
    if (!this.activePhoneSession) {
      return { success: false, error: 'EXPIRED', remainingAttempts: 0 }
    }

    const result = await verifyOtpCandidate(this.activePhoneSession, candidate)
    return result
  }

  getActivePhoneSession(): OtpSession | null {
    return this.activePhoneSession
  }
}

export const defaultAuthVerificationService = new AuthVerificationService()

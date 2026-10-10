export interface SendSmsResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface SmsProvider {
  readonly id: string
  readonly name: string
  sendOtp(phoneE164: string, otp: string): Promise<SendSmsResult>
}

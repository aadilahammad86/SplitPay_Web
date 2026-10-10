export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface EmailProvider {
  readonly id: string
  readonly name: string
  sendOtp(email: string, otp: string): Promise<SendEmailResult>
}

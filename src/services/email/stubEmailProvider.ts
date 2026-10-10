import type { EmailProvider, SendEmailResult } from './emailProvider'

export class StubEmailProvider implements EmailProvider {
  readonly id = 'stub'
  readonly name = 'Dev Simulator (In-Memory)'

  async sendOtp(_email: string, _otp: string): Promise<SendEmailResult> {
    // Simulator delivers via in-app banner
    return {
      success: true,
      messageId: `stub_mail_${Date.now()}`,
    }
  }
}

export const defaultStubEmailProvider = new StubEmailProvider()

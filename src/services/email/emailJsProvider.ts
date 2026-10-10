import type { EmailProvider, SendEmailResult } from './emailProvider'

export interface EmailJsConfig {
  serviceId: string
  templateId: string
  publicKey: string
}

/**
 * 100% Free For Life Email Provider using EmailJS
 * Free tier: 200 real emails per month forever, no credit card required.
 * Connects directly to personal Gmail or Outlook.
 */
export class EmailJsProvider implements EmailProvider {
  readonly id = 'emailjs'
  readonly name = 'EmailJS (Real Email - Free 200/mo)'

  private config: EmailJsConfig

  constructor(config: EmailJsConfig) {
    this.config = config
  }

  updateConfig(config: EmailJsConfig): void {
    this.config = config
  }

  async sendOtp(email: string, otp: string): Promise<SendEmailResult> {
    const { serviceId, templateId, publicKey } = this.config

    if (!serviceId.trim() || !templateId.trim() || !publicKey.trim()) {
      return {
        success: false,
        error: 'EmailJS credentials incomplete. Please configure Service ID, Template ID, and Public Key.',
      }
    }

    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: serviceId.trim(),
          template_id: templateId.trim(),
          user_id: publicKey.trim(),
          template_params: {
            to_email: email.trim(),
            email: email.trim(),
            otp_code: otp,
            code: otp,
            app_name: 'SplitPay',
          },
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return {
          success: false,
          error: `EmailJS error (${response.status}): ${errText || response.statusText}`,
        }
      }

      return {
        success: true,
        messageId: `emailjs_${Date.now()}`,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Network error sending email via EmailJS.',
      }
    }
  }
}

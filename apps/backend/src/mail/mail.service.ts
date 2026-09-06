import { Injectable, Logger } from '@nestjs/common';

export interface SendResetPasswordOptions {
  to: string;
  resetLink: string;
  userName?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendPasswordResetEmail({ to, resetLink, userName }: SendResetPasswordOptions): Promise<boolean> {
    const resendApiKey = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM || 'FinPilot AI <onboarding@resend.dev>';
    const recipientName = userName || to.split('@')[0];

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0B0F17; color: #F1F5F9; border-radius: 12px; border: 1px solid #1E293B;">
        <div style="margin-bottom: 24px; text-align: center;">
          <h2 style="color: #38BDF8; margin: 0; font-size: 24px; font-weight: 700;">FinPilot AI</h2>
          <p style="color: #94A3B8; font-size: 14px; margin-top: 4px;">Institutional Intelligence for Active Traders</p>
        </div>
        <div style="background: #111827; padding: 24px; border-radius: 8px; border: 1px solid #1F2937;">
          <h3 style="margin-top: 0; color: #FFFFFF; font-size: 18px;">Password Reset Request</h3>
          <p style="color: #94A3B8; font-size: 14px; line-height: 1.6;">
            Hello ${recipientName},<br/><br/>
            We received a request to reset your password for your FinPilot AI account. Click the button below to set a new password:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #2563EB, #0284C7); color: #FFFFFF; text-decoration: none; padding: 12px 28px; font-weight: 600; font-size: 14px; border-radius: 6px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
              Reset Password
            </a>
          </div>
          <p style="color: #64748B; font-size: 12px; line-height: 1.5; margin-top: 20px;">
            This link will expire in <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email. Your existing password will remain secure.
          </p>
          <p style="color: #475569; font-size: 11px; word-break: break-all; margin-top: 16px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <span style="color: #38BDF8;">${resetLink}</span>
          </p>
        </div>
      </div>
    `;

    if (!resendApiKey) {
      this.logger.log('==============================================================');
      this.logger.log(`[DEV/SIMULATION] Password Reset Email generated for: ${to}`);
      this.logger.log(`Reset Link: ${resetLink}`);
      this.logger.log('To send real emails, set RESEND_API_KEY in apps/backend/.env');
      this.logger.log('==============================================================');
      return true;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: 'Reset your FinPilot AI Password',
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Resend API error (${response.status}): ${errorText}`);
        return false;
      }

      this.logger.log(`Password reset email sent successfully via Resend to ${to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send email via Resend: ${err.message}`);
      return false;
    }
  }
}

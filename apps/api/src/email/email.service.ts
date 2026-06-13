import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const EMAIL_SEND_TIMEOUT_MS = 10000;

@Injectable()
export class EmailService {
  private readonly resend: Resend | null;
  private readonly emailDevMode: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.emailDevMode =
      this.configService.get<string>('EMAIL_DEV_MODE') === 'true';
  }

  async sendVerificationOtp(params: {
    to: string;
    fullName: string;
    otp: string;
  }) {
    if (this.shouldPrintOtpInDev()) {
      this.printDevOtp('Email verification', params);
      return;
    }

    if (!this.resend) {
      throw new ServiceUnavailableException('email provider is not configured');
    }

    const from =
      this.configService.get<string>('EMAIL_FROM') ??
      'Tutor Booking <onboarding@resend.dev>';
    const { error } = await this.withTimeout(
      this.resend.emails.send({
        from,
        to: params.to,
        subject: 'Your Tutor Booking verification code',
        html: this.renderVerificationOtpEmail(params.fullName, params.otp),
      }),
      EMAIL_SEND_TIMEOUT_MS,
    );

    if (error) {
      throw new ServiceUnavailableException(
        `email provider rejected the request: ${error.message}`,
      );
    }
  }

  async sendPasswordResetOtp(params: {
    to: string;
    fullName: string;
    otp: string;
  }) {
    if (this.shouldPrintOtpInDev()) {
      this.printDevOtp('Password reset', params);
      return;
    }

    if (!this.resend) {
      throw new ServiceUnavailableException('email provider is not configured');
    }

    const from =
      this.configService.get<string>('EMAIL_FROM') ??
      'Tutor Booking <onboarding@resend.dev>';
    const { error } = await this.withTimeout(
      this.resend.emails.send({
        from,
        to: params.to,
        subject: 'Your Tutor Booking password reset code',
        html: this.renderPasswordResetOtpEmail(params.fullName, params.otp),
      }),
      EMAIL_SEND_TIMEOUT_MS,
    );

    if (error) {
      throw new ServiceUnavailableException(
        `email provider rejected the request: ${error.message}`,
      );
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
    let timeout: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('email provider request timed out')),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      throw new ServiceUnavailableException(message);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private renderVerificationOtpEmail(fullName: string, otp: string) {
    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h1 style="font-size: 20px;">Verify your Tutor Booking account</h1>
        <p>Hi ${this.escapeHtml(fullName)},</p>
        <p>Use this verification code to activate your account:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      </div>
    `;
  }

  private renderPasswordResetOtpEmail(fullName: string, otp: string) {
    return `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h1 style="font-size: 20px;">Reset your Tutor Booking password</h1>
        <p>Hi ${this.escapeHtml(fullName)},</p>
        <p>Use this code to reset your password:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">${otp}</p>
        <p>This code expires in 15 minutes.</p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      </div>
    `;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private shouldPrintOtpInDev() {
    return (
      this.emailDevMode &&
      this.configService.get<string>('NODE_ENV') !== 'production'
    );
  }

  private printDevOtp(
    purpose: string,
    params: {
      to: string;
      fullName: string;
      otp: string;
    },
  ) {
    console.info(
      `[DEV EMAIL OTP] ${purpose} for ${params.to} (${params.fullName}): ${params.otp}`,
    );
  }
}

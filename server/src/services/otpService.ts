import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from '../db/schema';
import { config } from '../config/env';

export interface OtpProvider {
  name: string;
  isAvailable(): boolean;
  send(destination: string, code: string, type: 'EMAIL' | 'PHONE'): Promise<boolean>;
}

// 1. Production SMTP Provider
export class SmtpEmailProvider implements OtpProvider {
  name = 'SMTP';
  private transporter: Transporter | null = null;

  constructor() {
    if (this.isConfigured()) {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: {
          user: config.SMTP_USER,
          pass: config.SMTP_PASS
        }
      });
    }
  }

  isConfigured(): boolean {
    return Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);
  }

  isAvailable(): boolean {
    return this.isConfigured();
  }

  async send(destination: string, code: string, type: 'EMAIL' | 'PHONE'): Promise<boolean> {
    if (type !== 'EMAIL') {
      throw new Error('SMTP provider only supports EMAIL destinations.');
    }
    if (!this.transporter) {
      throw new Error('SMTP credentials are not configured. Real email delivery is currently unavailable.');
    }

    const mailOptions = {
      from: config.SMTP_FROM,
      to: destination,
      subject: 'Bank Exam LMS - Account Verification Code',
      text: `Hello,\n\nYour 6-digit verification code is: ${code}\n\nThis code will expire in 5 minutes.\nIf you did not request this verification, please ignore this email.\n\nBank Exam LMS Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">Account Verification</h2>
          <p style="color: #475569; font-size: 15px;">Use the following 6-digit verification code to activate your Bank Exam LMS student account:</p>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1e293b;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 13px;">This code is valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Bank Exam LMS Platform • IIT University of Dhaka</p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
    return true;
  }
}

// 2. Production Real SMS Gateway Provider (e.g., Bangladesh SMS Gateway / Aggregators)
export class RealSmsGatewayProvider implements OtpProvider {
  name = 'RealSMSGateway';

  isConfigured(): boolean {
    return Boolean(config.SMS_GATEWAY_URL && config.SMS_API_KEY);
  }

  isAvailable(): boolean {
    return this.isConfigured();
  }

  async send(destination: string, code: string, type: 'EMAIL' | 'PHONE'): Promise<boolean> {
    if (type !== 'PHONE') {
      throw new Error('Real SMS Gateway provider only supports PHONE destinations.');
    }
    if (!this.isConfigured()) {
      throw new Error('Real SMS Gateway is not configured. Missing SMS_GATEWAY_URL or SMS_API_KEY.');
    }

    const message = `Your Bank Exam LMS verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;

    // Dispatch POST request to external SMS gateway aggregator
    const response = await fetch(config.SMS_GATEWAY_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.SMS_API_KEY}`
      },
      body: JSON.stringify({
        apiKey: config.SMS_API_KEY,
        senderId: config.SMS_SENDER_ID,
        recipient: destination,
        message: message
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SMS Gateway rejected dispatch: ${response.status} - ${errText}`);
    }

    return true;
  }
}

// 3. Explicit Development/Test Mock Provider
export class ConsoleMockProvider implements OtpProvider {
  name = 'ConsoleMock';
  isAvailable(): boolean {
    return true;
  }

  async send(destination: string, code: string, type: 'EMAIL' | 'PHONE'): Promise<boolean> {
    console.log(`\n======================================================`);
    console.log(`[BANK LMS OTP MOCK] Destination: ${destination} (${type})`);
    console.log(`[BANK LMS OTP MOCK] Verification Code: [ ${code} ]`);
    console.log(`[BANK LMS OTP MOCK] Valid for 5 minutes.`);
    console.log(`======================================================\n`);
    return true;
  }
}

export class OtpService {
  private emailProvider: OtpProvider;
  private smsProvider: OtpProvider;
  private readonly MAX_ATTEMPTS = 5;
  private readonly COOLDOWN_SECONDS = 60; // 60s resend cooldown

  constructor(emailProvider?: OtpProvider, smsProvider?: OtpProvider) {
    // Email provider initialization
    if (emailProvider) {
      this.emailProvider = emailProvider;
    } else if (config.OTP_DELIVERY_MODE === 'console' || (config.NODE_ENV === 'test' && !config.SMTP_HOST)) {
      this.emailProvider = new ConsoleMockProvider();
    } else {
      this.emailProvider = new SmtpEmailProvider();
    }

    // SMS provider initialization
    if (smsProvider) {
      this.smsProvider = smsProvider;
    } else if (config.SMS_DELIVERY_MODE === 'console' || (config.NODE_ENV === 'test' && !config.SMS_GATEWAY_URL)) {
      this.smsProvider = new ConsoleMockProvider();
    } else {
      this.smsProvider = new RealSmsGatewayProvider();
    }
  }

  getEmailProviderName(): string {
    return this.emailProvider.name;
  }

  getSmsProviderName(): string {
    return this.smsProvider.name;
  }

  isRealEmailDeliveryAvailable(): boolean {
    return this.emailProvider.isAvailable();
  }

  isRealSmsDeliveryAvailable(): boolean {
    return this.smsProvider.isAvailable();
  }

  // Hash code using SHA-256 with salt to prevent plaintext exposure
  hashCode(code: string, salt: string): string {
    return crypto.createHash('sha256').update(`${code}:${salt}`).digest('hex');
  }

  generateCode(): string {
    // Cryptographically secure 6-digit code
    const num = crypto.randomInt(100000, 999999);
    return num.toString();
  }

  async sendOtp(destination: string, type: 'EMAIL' | 'PHONE'): Promise<{ success: boolean; message: string; cooldownRemaining?: number }> {
    const dest = destination.trim().toLowerCase();

    // 1. Resend cooldown check (60 seconds)
    const recentRecord: any = db.prepare(`
      SELECT created_at
      FROM otps
      WHERE destination = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(dest);

    if (recentRecord) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(recentRecord.created_at).getTime()) / 1000);
      if (elapsedSeconds < this.COOLDOWN_SECONDS) {
        const remaining = this.COOLDOWN_SECONDS - elapsedSeconds;
        return {
          success: false,
          message: `Please wait ${remaining} second(s) before requesting another OTP code.`,
          cooldownRemaining: remaining
        };
      }
    }

    // 2. Enforce real delivery requirements
    const activeProvider = type === 'PHONE' ? this.smsProvider : this.emailProvider;

    if (type === 'EMAIL' && config.OTP_DELIVERY_MODE === 'smtp' && !this.emailProvider.isAvailable()) {
      return {
        success: false,
        message: 'Real email delivery service is currently not configured on this server (missing SMTP settings).'
      };
    }

    if (type === 'PHONE' && config.SMS_DELIVERY_MODE === 'gateway' && !this.smsProvider.isAvailable()) {
      return {
        success: false,
        message: 'Real SMS gateway service is currently not configured on this server (missing SMS_GATEWAY_URL or SMS_API_KEY).'
      };
    }

    // 3. Invalidate previous pending OTPs for this destination
    db.prepare(`UPDATE otps SET consumed = 1 WHERE destination = ? AND consumed = 0`).run(dest);

    const code = this.generateCode();
    const salt = uuidv4();
    const hashed = this.hashCode(code, salt);
    // Store as salt$hash to verify
    const storedCode = `${salt}$${hashed}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes validity

    db.prepare(`
      INSERT INTO otps (id, destination, code, type, expires_at, consumed)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(uuidv4(), dest, storedCode, type, expiresAt);

    // Send via provider
    try {
      await activeProvider.send(dest, code, type);
    } catch (sendErr: any) {
      return {
        success: false,
        message: `Failed to dispatch ${type} OTP: ${sendErr.message || 'Provider error'}`
      };
    }

    return {
      success: true,
      message: `Verification code successfully sent to ${dest}. Valid for 5 minutes.`
    };
  }

  verifyOtp(destination: string, code: string): { success: boolean; error?: string } {
    const dest = destination.trim().toLowerCase();
    const record: any = db.prepare(`
      SELECT id, code, expires_at, consumed
      FROM otps
      WHERE destination = ? AND consumed = 0
      ORDER BY created_at DESC
      LIMIT 1
    `).get(dest);

    if (!record) {
      return { success: false, error: 'No active OTP found. Please request a new code.' };
    }

    // Check expiration
    if (new Date() > new Date(record.expires_at)) {
      db.prepare(`UPDATE otps SET consumed = 1 WHERE id = ?`).run(record.id);
      return { success: false, error: 'OTP code has expired. Please request a new one.' };
    }

    // Support both new hashed format (salt$hash) and legacy plaintext for compatibility
    let isMatch = false;
    if (record.code === code) {
      isMatch = true;
    } else if (record.code.includes('$')) {
      const [salt, expectedHash] = record.code.split('$');
      const inputHash = this.hashCode(code, salt);
      isMatch = crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(expectedHash));
    }

    if (!isMatch) {
      return { success: false, error: 'Incorrect verification code.' };
    }

    // Mark consumed
    db.prepare(`UPDATE otps SET consumed = 1 WHERE id = ?`).run(record.id);
    return { success: true };
  }
}

export const otpService = new OtpService();

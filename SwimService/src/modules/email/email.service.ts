import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

type VerificationPurpose = 'register' | 'change_password' | 'change_email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporterPromise?: Promise<nodemailer.Transporter>;

  constructor(private readonly configService: ConfigService) {}

  async sendVerificationCode(params: {
    email: string;
    code: string;
    purpose: VerificationPurpose;
    expiresInMinutes: number;
  }) {
    const provider = this.getProvider();
    const message = this.buildVerificationMessage(params);

    if (provider === 'smtp') {
      await this.sendViaSmtp({
        to: params.email,
        ...message,
      });
      return;
    }

    await this.writeToLocalOutbox({
      to: params.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private getProvider() {
    return this.configService.get<string>('EMAIL_PROVIDER')?.trim() || 'log';
  }

  private buildVerificationMessage(params: {
    email: string;
    code: string;
    purpose: VerificationPurpose;
    expiresInMinutes: number;
  }) {
    const purposeLabelMap: Record<VerificationPurpose, string> = {
      register: '注册账号',
      change_email: '修改邮箱',
      change_password: '修改密码',
    };

    const purposeLabel = purposeLabelMap[params.purpose];
    const subject = '泳池水质通 | 验证码';
    const text = [
      '你好，',
      '',
      `你正在进行“${purposeLabel}”操作。`,
      `本次验证码为：${params.code}`,
      `验证码将在 ${params.expiresInMinutes} 分钟后失效。`,
      '',
      '本邮件由系统自动发送，请勿直接回复。',
      '',
      '如果这不是你的操作，请忽略这封邮件。',
      '',
      '泳池水质通',
    ].join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif; color: #0f172a; line-height: 1.6;">
        <p>你好，</p>
        <p>你正在进行“${purposeLabel}”操作。</p>
        <div style="margin: 16px 0; padding: 14px 16px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; display: inline-block;">
          <div style="font-size: 12px; color: #475569;">验证码</div>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #0f172a;">${params.code}</div>
        </div>
        <p>验证码将在 ${params.expiresInMinutes} 分钟后失效。</p>
        <p style="color: #64748b;">本邮件由系统自动发送，请勿直接回复。</p>
        <p>如果这不是你的操作，请忽略这封邮件。</p>
        <p style="color: #64748b;">泳池水质通</p>
      </div>
    `.trim();

    return { subject, text, html };
  }

  private async sendViaSmtp(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) {
    const transporter = await this.getSmtpTransporter();
    const from =
      this.configService.get<string>('EMAIL_FROM')?.trim() ||
      'noreply@example.com';
    const diagnostic =
      String(
        this.configService.get<string>('EMAIL_SMTP_DIAGNOSTIC') ?? 'false',
      ).toLowerCase() === 'true';
    const host =
      this.configService.get<string>('EMAIL_SMTP_HOST')?.trim() || '';
    const port = Number(
      this.configService.get<string>('EMAIL_SMTP_PORT') || 587,
    );
    const secure =
      String(
        this.configService.get<string>('EMAIL_SMTP_SECURE') || 'false',
      ).toLowerCase() === 'true';

    try {
      const info = await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      if (diagnostic) {
        this.logger.log(
          `验证码邮件已通过 SMTP 发送：${JSON.stringify({
            to: message.to,
            from,
            host,
            port,
            secure,
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response,
          })}`,
        );
      } else {
        this.logger.log(
          `验证码邮件已发送：to=${message.to} messageId=${info.messageId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `验证码邮件发送失败：to=${message.to} subject=${message.subject}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async getSmtpTransporter() {
    if (!this.transporterPromise) {
      this.transporterPromise = Promise.resolve(
        nodemailer.createTransport({
          host: this.requireConfig('EMAIL_SMTP_HOST'),
          port: Number(
            this.configService.get<string>('EMAIL_SMTP_PORT') || 587,
          ),
          secure:
            String(
              this.configService.get<string>('EMAIL_SMTP_SECURE') || 'false',
            ).toLowerCase() === 'true',
          auth: {
            user: this.requireConfig('EMAIL_SMTP_USER'),
            pass: this.requireConfig('EMAIL_SMTP_PASSWORD'),
          },
        }),
      );
    }

    return this.transporterPromise;
  }

  private requireConfig(key: string) {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new Error(`缺少邮件配置：${key}`);
    }
    return value;
  }

  private async writeToLocalOutbox(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) {
    const outputDir = join(
      process.cwd(),
      this.configService.get<string>('EMAIL_LOCAL_OUTPUT_DIR')?.trim() ||
        'runtime/emails',
    );

    await mkdir(outputDir, { recursive: true });

    const fileName = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`;
    const payload = {
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      createdAt: new Date().toISOString(),
    };

    await writeFile(
      join(outputDir, fileName),
      JSON.stringify(payload, null, 2),
      'utf8',
    );

    this.logger.log(
      `验证码邮件已写入本地邮箱目录：${join(outputDir, fileName)}`,
    );
  }
}

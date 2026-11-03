import type { AppConfig } from '@/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Mail, type SMTPSentMessageInfo } from 'nodemailer';
@Injectable()
export class EmailService implements OnModuleInit {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}
  private transporter!: Mail<SMTPSentMessageInfo>;
  async sendVerifyEmail(email: string, url: string) {
    const expireMinute = this.configService.get('auth.verifyMailExpireMinute', {
      infer: true,
    });
    await this.transporter.sendMail({
      from: this.configService.get('mail.from', { infer: true }),
      to: email,
      subject: 'Flowboard - 驗證你的帳號',
      html: `<h3>歡迎註冊 Flowboard App</h3>
            <p>請點擊下方連結驗證你的信箱：</p>
            <a href="${url}">點擊驗證</a>
            <p>此連結將在 ${expireMinute} 分鐘後失效。</p>`,
    });
  }
  onModuleInit() {
    const mail = this.configService.get('mail', { infer: true });
    this.transporter = nodemailer.createTransport({
      host: mail.smtpHost,
      port: mail.smtpPort,
      secure: true,
      auth: {
        user: mail.smtpUser,
        pass: mail.smtpPassword,
      },
    });
  }
}

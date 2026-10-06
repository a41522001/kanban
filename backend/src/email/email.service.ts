import type { Env } from '@/config/env';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Mail, type SMTPSentMessageInfo } from 'nodemailer';
@Injectable()
export class EmailService implements OnModuleInit {
  constructor(private readonly configService: ConfigService<Env>) {}
  private transporter!: Mail<SMTPSentMessageInfo>;
  async sendVerifyEmail(email: string, url: string) {
    const expireMinute = this.configService.getOrThrow(
      'VERIFY_MAIL_EXPIRE_MINUTE',
      { infer: true },
    );
    await this.transporter.sendMail({
      from: this.configService.getOrThrow('MAIL_FROM', { infer: true }),
      to: email,
      subject: 'Flowboard - 驗證你的帳號',
      html: `<h3>歡迎註冊 Flowboard App</h3>
            <p>請點擊下方連結驗證你的信箱：</p>
            <a href="${url}">點擊驗證</a>
            <p>此連結將在 ${expireMinute} 分鐘後失效。</p>`,
    });
  }
  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow('SMTP_HOST', { infer: true }),
      port: this.configService.getOrThrow('SMTP_PORT', { infer: true }),
      secure: true,
      auth: {
        user: this.configService.getOrThrow('SMTP_USER', { infer: true }),
        pass: this.configService.getOrThrow('SMTP_PASSWORD', { infer: true }),
      },
    });
  }
}

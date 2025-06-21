import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: any;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailConfig = this.configService.get('email');

    this.transporter = nodemailer.createTransport({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: {
        user: emailConfig.smtp.user,
        pass: emailConfig.smtp.pass,
      },
    });
  }

  /**
   * 发送验证码邮件
   */
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    try {
      const emailConfig = this.configService.get('email');

      const mailOptions = {
        from: emailConfig.from,
        to: email,
        subject: '验证码 - Auth Service',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">验证码</h2>
            <p>您的验证码是：</p>
            <div style="font-size: 24px; font-weight: bold; color: #007bff; padding: 10px; background-color: #f8f9fa; border-radius: 4px; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #666;">此验证码将在10分钟后过期，请尽快使用。</p>
            <p style="color: #666;">如果您未申请此验证码，请忽略此邮件。</p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`验证码邮件已发送至: ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`发送邮件失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 发送密码重置邮件
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    try {
      const emailConfig = this.configService.get('email');
      const resetUrl = `${
        process.env.FRONTEND_URL || 'http://localhost:3000'
      }/reset-password?token=${resetToken}`;

      const mailOptions = {
        from: emailConfig.from,
        to: email,
        subject: '密码重置 - Auth Service',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">密码重置</h2>
            <p>您申请了密码重置，请点击下面的链接重置您的密码：</p>
            <div style="margin: 20px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">重置密码</a>
            </div>
            <p style="color: #666;">此链接将在1小时后过期。</p>
            <p style="color: #666;">如果您未申请密码重置，请忽略此邮件。</p>
            <p style="color: #999; font-size: 12px;">如果按钮无法点击，请复制以下链接到浏览器：<br>${resetUrl}</p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`密码重置邮件已发送至: ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`发送密码重置邮件失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 发送欢迎邮件
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    try {
      const emailConfig = this.configService.get('email');

      const mailOptions = {
        from: emailConfig.from,
        to: email,
        subject: '欢迎注册 - Auth Service',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">欢迎加入！</h2>
            <p>亲爱的 ${firstName}，</p>
            <p>感谢您注册Auth Service！您的账户已经创建成功。</p>
            <p>现在您可以使用您的邮箱和密码登录系统了。</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #495057;">接下来您可以：</h3>
              <ul style="color: #666;">
                <li>完善您的个人资料</li>
                <li>开始使用我们的服务</li>
                <li>探索更多功能</li>
              </ul>
            </div>
            <p style="color: #666;">如有任何问题，请随时联系我们。</p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`欢迎邮件已发送至: ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`发送欢迎邮件失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 发送通用邮件
   */
  async sendEmail(to: string, subject: string, content: string): Promise<boolean> {
    try {
      const emailConfig = this.configService.get('email');

      const mailOptions = {
        from: emailConfig.from,
        to,
        subject,
        html: content,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`邮件已发送至: ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`发送邮件失败: ${error.message}`);
      return false;
    }
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { SmsService } from './sms.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

export class SendVerificationSmsDto {
  phoneNumber: string;
  code: string;
  tenantId?: string;
}

export class SendCustomSmsDto {
  phoneNumber: string;
  message: string;
  tenantId?: string;
}

@ApiTags('SMS Service')
@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post('send-verification')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: '发送短信验证码' })
  @ApiBody({ type: SendVerificationSmsDto })
  @ApiResponse({ status: 200, description: '短信发送成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 429, description: '发送频率过高' })
  async sendVerificationSms(
    @Body() dto: SendVerificationSmsDto,
    @GetUser() user?: any,
  ) {
    const { phoneNumber, code, tenantId } = dto;

    if (!phoneNumber || !code) {
      throw new BadRequestException('手机号码和验证码不能为空');
    }

    if (!/^\d{4,8}$/.test(code)) {
      throw new BadRequestException('验证码格式错误');
    }

    const result = await this.smsService.sendVerificationCode(
      phoneNumber,
      code,
      tenantId,
      user?.userId,
    );

    return {
      success: result.success,
      messageId: result.messageId,
      expiresAt: result.expiresAt,
      provider: result.provider,
      cost: result.cost,
      error: result.error,
    };
  }

  @Post('send-custom')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '发送自定义短信（管理员）' })
  @ApiBody({ type: SendCustomSmsDto })
  @ApiResponse({ status: 200, description: '短信发送成功' })
  async sendCustomSms(
    @Body() dto: SendCustomSmsDto,
    @GetUser() user: any,
  ) {
    const { phoneNumber, message, tenantId } = dto;

    if (!phoneNumber || !message) {
      throw new BadRequestException('手机号码和消息内容不能为空');
    }

    if (message.length > 500) {
      throw new BadRequestException('短信内容不能超过500字符');
    }

    const result = await this.smsService.sendCustomSms(
      phoneNumber,
      message,
      tenantId,
      user.userId,
    );

    return {
      success: result.success,
      messageId: result.messageId,
      provider: result.provider,
      cost: result.cost,
      error: result.error,
    };
  }

  @Get('rate-limit')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: '查询短信发送频率限制' })
  @ApiResponse({ status: 200, description: '频率限制信息' })
  async getRateLimit(@Query('phoneNumber') phoneNumber: string) {
    if (!phoneNumber) {
      throw new BadRequestException('手机号码不能为空');
    }

    const rateLimitInfo = await this.smsService.getRateLimitInfo(phoneNumber);
    
    return {
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      hourly: {
        used: rateLimitInfo.hourlyCount,
        limit: rateLimitInfo.hourlyLimit,
        remaining: Math.max(0, rateLimitInfo.hourlyLimit - rateLimitInfo.hourlyCount),
        resetAt: rateLimitInfo.nextResetHour,
      },
      daily: {
        used: rateLimitInfo.dailyCount,
        limit: rateLimitInfo.dailyLimit,
        remaining: Math.max(0, rateLimitInfo.dailyLimit - rateLimitInfo.dailyCount),
        resetAt: rateLimitInfo.nextResetDay,
      },
    };
  }

  @Get('status')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取SMS服务状态（管理员）' })
  @ApiResponse({ status: 200, description: 'SMS服务状态' })
  async getServiceStatus() {
    return this.smsService.getServiceStatus();
  }

  @Get('supported-countries')
  @ApiOperation({ summary: '获取支持的国家列表' })
  @ApiResponse({ status: 200, description: '支持的国家代码列表' })
  async getSupportedCountries() {
    const countries = this.smsService.getSupportedCountries();
    return {
      countries,
      count: countries.length,
    };
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }
}
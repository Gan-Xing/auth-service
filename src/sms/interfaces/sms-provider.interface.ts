export interface SmsResult {
  success: boolean;
  messageId?: string;
  cost?: number;
  error?: string;
  provider: string;
}

export interface SmsMessage {
  to: string;
  text: string;
  from?: string;
}

export interface SmsProvider {
  name: string;
  sendSms(message: SmsMessage): Promise<SmsResult>;
  validateConfig(): boolean;
  getSupportedCountries(): string[];
}
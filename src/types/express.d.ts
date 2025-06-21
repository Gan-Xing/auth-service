import 'express-session';

declare module 'express-session' {
  interface SessionData {
    adminToken?: string;
    adminUser?: {
      id: number;
      email: string;
      firstName?: string;
      lastName?: string;
    };
  }
}
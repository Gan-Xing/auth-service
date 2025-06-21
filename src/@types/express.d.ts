declare namespace Express {
  interface Request {
    user?: any;
    isAdmin?: boolean;
    session?: {
      [key: string]: any;
    };
  }
}
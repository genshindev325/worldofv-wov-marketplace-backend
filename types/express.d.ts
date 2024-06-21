import 'express';

declare global {
  namespace Express {
    interface AuthInfo {
      state?: {
        socialUser?: string;
      };
    }
  }
}

import { Request } from 'express';

export type AppAuthContext = {
  id: string;
  email: string;
  status: string;
};

export type AdminAuthContext = {
  id: string;
  account: string;
  role: string;
  status: string;
  tokenId?: string;
};

export type AuthenticatedRequest = Request & {
  currentUser?: AppAuthContext;
  currentAdmin?: AdminAuthContext;
};

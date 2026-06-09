/**
 * FlowOS mobile - src/navigation/types.ts
 * Navigation param lists for typed navigation/route props.
 */
import type { Business, Queue } from '../api/types';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string; devCode?: string };
  ForgotPassword: undefined;
};

export type CustomerStackParamList = {
  CustomerTabs: undefined;
  BusinessDetails: { businessId: string };
};

export type BusinessStackParamList = {
  BusinessTabs: undefined;
  CreateBusiness: undefined;
  BusinessSetup: { business: Business };
  QueueForm: { businessId: string; queue?: Queue };
  QueueManager: { queueId: string; queueName: string };
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  BusinessReview: { business: Business };
};

export interface ProcessWithdrawalParams {
  withdrawalId: string;
  status: 'processing' | 'completed' | 'rejected';
  adminNote?: string;
  processedBy: string;
}

export interface ApplyReferralParams {
  userId: string;
  referralCode: string | null | undefined;
}

export interface ApplyReferralResult {
  applied: boolean;
  reason?: string;
  bonusGranted?: boolean;
  bonusError?: string;
}

export interface CommissionResult {
  created: boolean;
  commissionId?: string;
  amount?: number;
  error?: string;
}

export interface RequestWithdrawalParams {
  userId: string;
  amount: number;
  paymentMethod: string;
  paymentAccount: string;
  /** Stable server-scoped identifier used to make form retries idempotent. */
  requestId?: string;
}

export interface RequestWithdrawalResult {
  success: boolean;
  withdrawalId?: string;
  idempotent?: boolean;
  error?: string;
}

export interface ProcessWithdrawalResult {
  success: boolean;
  error?: string;
}

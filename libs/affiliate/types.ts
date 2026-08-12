export interface ProcessWithdrawalParams {
  withdrawalId: string;
  status: 'processing' | 'completed' | 'rejected';
  adminNote?: string;
  processedBy: string;
}

export interface ProcessWithdrawalResult {
  success: boolean;
  error?: string;
}

import { calculateCreditConsumption, creditService, safeNumber, TransactionTypeCode } from '@libs/credits';
import type { UIMessage } from 'ai';

export const CHAT_MAX_MESSAGES = 50;
export const CHAT_MAX_REQUEST_BYTES = 24 * 1024;
export const CHAT_MAX_OUTPUT_TOKENS = 1024;
const CHAT_TOKEN_OVERHEAD = 2048;

export interface ChatBillingContext {
  userId: string;
  requestId: string;
  provider: string;
  model: string;
}

export function getChatRequestBytes(messages: UIMessage[]): number {
  return new TextEncoder().encode(JSON.stringify(messages)).byteLength;
}

/**
 * UTF-8 byte count is a conservative upper bound for tokenizer output.
 * The additional allowance covers role/template framing added by providers.
 */
export function calculateChatReservationCredits(
  messages: UIMessage[],
  model: string,
  provider: string,
): number {
  const upperBoundTokens = getChatRequestBytes(messages) + CHAT_MAX_OUTPUT_TOKENS + CHAT_TOKEN_OVERHEAD;
  return calculateCreditConsumption({ totalTokens: upperBoundTokens, model, provider, type: 'aiChat' });
}

export async function reserveChatCredits(
  context: ChatBillingContext,
  messages: UIMessage[],
) {
  const reservedCredits = calculateChatReservationCredits(messages, context.model, context.provider);
  const transactionId = `ai-chat:${context.requestId}`;
  const result = await creditService.consumeCredits({
    userId: context.userId,
    amount: reservedCredits,
    transactionId,
    description: TransactionTypeCode.AI_CHAT,
    metadata: {
      phase: 'reservation',
      provider: context.provider,
      model: context.model,
      requestBytes: getChatRequestBytes(messages),
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
    },
  });
  return { ...result, reservedCredits, transactionId };
}

export async function settleChatCredits(
  context: ChatBillingContext,
  reservation: { reservedCredits: number; transactionId: string },
  usage: { totalTokens?: number; inputTokens?: number; outputTokens?: number },
) {
  const inputTokens = safeNumber(usage.inputTokens);
  const outputTokens = safeNumber(usage.outputTokens);
  const totalTokens = safeNumber(usage.totalTokens, inputTokens + outputTokens);
  if (totalTokens <= 0) {
    await refundChatCredits(context, reservation, 'missing_usage');
    return { chargedCredits: 0, refundedCredits: reservation.reservedCredits };
  }

  const chargedCredits = calculateCreditConsumption({
    totalTokens,
    model: context.model,
    provider: context.provider,
    type: 'aiChat',
  });
  const difference = reservation.reservedCredits - chargedCredits;
  if (difference > 0) {
    await creditService.addCredits({
      userId: context.userId,
      amount: difference,
      type: 'refund',
      transactionId: `settlement-refund:${reservation.transactionId}`,
      description: TransactionTypeCode.REFUND,
      metadata: {
        phase: 'settlement',
        originalTransactionId: reservation.transactionId,
        provider: context.provider,
        model: context.model,
        inputTokens,
        outputTokens,
        totalTokens,
      },
    });
  } else if (difference < 0) {
    const additional = await creditService.consumeCredits({
      userId: context.userId,
      amount: -difference,
      transactionId: `settlement-charge:${reservation.transactionId}`,
      description: TransactionTypeCode.AI_CHAT,
      metadata: {
        phase: 'settlement',
        originalTransactionId: reservation.transactionId,
        provider: context.provider,
        model: context.model,
        inputTokens,
        outputTokens,
        totalTokens,
      },
    });
    if (!additional.success) throw new Error(additional.error || 'Failed to settle AI chat credits');
  }
  return { chargedCredits, refundedCredits: Math.max(0, difference) };
}

export async function refundChatCredits(
  context: ChatBillingContext,
  reservation: { reservedCredits: number; transactionId: string },
  reason: string,
) {
  return creditService.addCredits({
    userId: context.userId,
    amount: reservation.reservedCredits,
    type: 'refund',
    transactionId: `failure-refund:${reservation.transactionId}`,
    description: TransactionTypeCode.REFUND,
    metadata: {
      phase: 'failure',
      originalTransactionId: reservation.transactionId,
      provider: context.provider,
      model: context.model,
      reason,
    },
  });
}

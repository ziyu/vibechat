import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { createChatProvider } from './providers';
import { getProviderConfig } from './config';
import type { ChatProviderName } from './types';
import { summarizeAIError } from './error';

interface StreamOptions {
  messages: UIMessage[];
  provider?: ChatProviderName;
  model?: string;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

interface UsageData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface StreamResponseWithUsage {
  response: Response;
  usage: Promise<UsageData>;
  provider: string;
  model: string;
}

/**
 * Stream AI response with usage tracking capability
 * Returns both the response and a promise for usage data
 * Note: In AI SDK v6, convertToModelMessages is async
 */
export async function streamResponseWithUsage({ messages, provider, model, maxOutputTokens, abortSignal }: StreamOptions): Promise<StreamResponseWithUsage> {
  // Validate messages
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Invalid messages: messages must be an array');
  }
  
  // Validate each message
  messages.forEach((message, index) => {
    if (!message || typeof message !== 'object') {
      throw new Error(`Invalid message at index ${index}: message must be an object`);
    }
    if (!message.role || typeof message.role !== 'string') {
      throw new Error(`Invalid message at index ${index}: role must be a string`);
    }
  });
  
  const providerName = provider || 'openai';
  const config = getProviderConfig(providerName);
  const aiProvider = createChatProvider(providerName, config);
  const { config: appConfig } = await import('@config');
  const resolvedModel = model || appConfig.ai.defaultModels[providerName];
  
  // AI SDK v6: convertToModelMessages is now async
  const modelMessages = await convertToModelMessages(messages);
  
  // Note: Using 'any' cast due to version mismatch between @ai-sdk/* packages
  // This is safe as the runtime behavior is correct
  const result = streamText({
    model: aiProvider(resolvedModel) as any,
    messages: modelMessages,
    maxOutputTokens,
    abortSignal,
    // The SDK default prints full provider request/response objects. Keep logs
    // useful without retaining prompts, response bodies, headers or keys.
    onError: ({ error }) => {
      console.error('AI provider stream error:', summarizeAIError(error));
    },
  });
  
  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: () => crypto.randomUUID(),
  });
  
  // Use SDK's usage data directly with safe defaults
  const usagePromise = (async (): Promise<UsageData> => {
    const usage = await result.usage;
    return {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
    };
  })();

  return {
    response,
    usage: usagePromise,
    provider: providerName,
    model: resolvedModel
  };
}

/**
 * Simple stream response (backwards compatible)
 * Use streamResponseWithUsage for credit consumption tracking
 */
export async function streamResponse({ messages, provider, model }: StreamOptions): Promise<Response> {
  const result = await streamResponseWithUsage({ messages, provider, model });
  return result.response;
}

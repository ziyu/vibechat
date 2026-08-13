export * from './types';
export { 
  createChatProvider, 
  createImageProvider, 
  createVideoProvider,
  fal 
} from './providers';
export { 
  getConfig, 
  getProviderConfig, 
  getApiKey, 
  getBaseUrl, 
  hasCapability,
} from './config';
export { streamResponse, streamResponseWithUsage } from './utils';
export { summarizeAIError } from './error';
export {
  CHAT_MAX_MESSAGES,
  CHAT_MAX_REQUEST_BYTES,
  CHAT_MAX_OUTPUT_TOKENS,
  calculateChatReservationCredits,
  getChatRequestBytes,
  reserveChatCredits,
  settleChatCredits,
  refundChatCredits,
} from './chat-billing';
export { 
  generateImageResponse, 
  calculateImageCreditCost,
  getImageSizesForProvider,
} from './image';
export {
  generateVideoResponse,
  createVideoTask,
  queryVideoTask,
  calculateVideoCreditCost,
  getVideoSizesForProvider,
  getVideoDurationsForProvider,
} from './video';

// Re-export image config from config folder
export { aiImageConfig } from '../../config/aiImage';

// Re-export video config from config folder
export { aiVideoConfig } from '../../config/aiVideo';
export {
  createImageTaskRecord,
  getImageTaskRecord,
  markImageTaskFailed,
  markImageTaskSucceeded,
} from './image-task-store';
export {
  attachVideoProviderTask,
  createVideoTaskRecord,
  getVideoTaskRecord,
  markVideoTaskFailed,
  markVideoTaskRefunded,
  markVideoTaskSucceeded,
  reserveVideoTaskRecord,
} from './video-task-store';

import { createChatProvider } from './providers';
import { getConfig, getProviderConfig } from './config';
import type { ChatProviderName } from './types';

/**
 * Create a chat AI handler with default or specified provider
 * For image generation, use generateImageResponse() instead
 */
export function createAIHandler(options: { provider?: ChatProviderName } = {}) {
  if (options.provider) {
    return createChatProvider(options.provider, getProviderConfig(options.provider));
  }
  const config = getConfig();
  return createChatProvider(config.provider, config.config);
}

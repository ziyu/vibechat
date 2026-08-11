import { SocialServiceError } from '@libs/social'
import { productApiError } from './product-api'

export function socialServiceErrorResponse(requestId: string, error: SocialServiceError) {
  const status = error.code === 'SOCIAL_USER_NOT_FOUND'
    || error.code === 'SOCIAL_REQUEST_NOT_FOUND'
    ? 404
    : error.code === 'SOCIAL_BLOCKED' || error.code === 'SOCIAL_SELF_REQUEST_FORBIDDEN'
      ? 403
      : 409
  return productApiError(requestId, status, error.code, error.code)
}

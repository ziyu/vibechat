import {
  atmosphereSpaceDirectorySchema,
  friendRequestMutationResponseSchema,
  productApiErrorSchema,
  flatProductApiErrorSchema,
  productPreferencesSchema,
  productProfileSchema,
  productStateSnapshotSchema,
  productRoomPreferenceSchema,
  roomBootstrapSchema,
  roomMetadataLookupResponseSchema,
  sessionBootstrapSchema,
  socialMutationStatusSchema,
  socialSnapshotSchema,
  updateSpaceFavoriteResponseSchema,
  uploadImageResponseSchema,
  userSearchResponseSchema,
  type CreateRoomRequest,
  type ProductApiError,
  type ProductStateSnapshotResponse,
  type SocialPerson,
  type UpdateProductProfile,
  type ContractSchema,
  pricingPlansResponseSchema,
  creditStatusResponseSchema,
  creditTransactionsResponseSchema,
  ordersResponseSchema,
  subscriptionStatusResponseSchema,
  affiliateStatsResponseSchema,
  commissionsResponseSchema,
  referralsResponseSchema,
  withdrawalsResponseSchema,
  withdrawalRequestInputSchema,
  withdrawalRequestResponseSchema,
  paymentInitiateInputSchema,
  paymentInitiateResponseSchema,
  subscriptionPortalResponseSchema,
  type WithdrawalRequestInput,
  type PaymentInitiateInput,
  imageGenerationInputSchema,
  imageGenerationResponseSchema,
  videoGenerationInputSchema,
  videoGenerationResponseSchema,
  videoTaskStatusResponseSchema,
  type ImageGenerationInput,
  type VideoGenerationInput,
  spaceRuntimeSnapshotSchema,
  spaceAppBridgeResponseSchema,
  spaceTurnAcceptedSchema,
  type SpaceAppBridgeRequest,
  type CreateSpaceAgentTurnRequest,
  type PublishSpaceAppRequest,
  type RestoreSpaceAppRequest,
  type ApplySpaceTemplateRequest,
} from '@vibechat/api-contracts'

export interface ProductApiTransport {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

export interface ProductApiClientOptions {
  baseUrl?: string | URL
  transport?: ProductApiTransport
}

export class ProductApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>
  readonly requestId: string | null

  constructor(response: Response, body: ProductApiError | null, fallbackCode: string) {
    super(body?.error.message || fallbackCode)
    this.name = 'ProductApiClientError'
    this.status = response.status
    this.code = body?.error.code || fallbackCode
    this.details = body?.error.details || {}
    this.requestId = body?.error.requestId || response.headers.get('x-request-id')
  }
}

function defaultTransport(): ProductApiTransport {
  return { fetch: (input, init) => globalThis.fetch(input, init) }
}

export class ProductApiClient {
  private readonly baseUrl: URL | null
  private readonly transport: ProductApiTransport

  constructor(options: ProductApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ? new URL(options.baseUrl) : null
    this.transport = options.transport || defaultTransport()
  }

  private resolve(path: string) {
    return this.baseUrl ? new URL(path, this.baseUrl) : path
  }

  private async parseError(response: Response): Promise<ProductApiError | null> {
    const raw = await response.json().catch(() => null)
    const parsed = productApiErrorSchema.safeParse(raw)
    if (parsed.success) return parsed.data

    const flat = flatProductApiErrorSchema.safeParse(raw)
    if (!flat.success) return null
    return {
      error: {
        code: flat.data.error.toUpperCase(),
        message: flat.data.message || flat.data.error,
        details: Object.fromEntries(
          Object.entries(flat.data).filter(([key]) => !['error', 'message', 'requestId'].includes(key)),
        ),
        requestId: flat.data.requestId || null,
      },
    }
  }

  private async request<T>(
    path: string,
    schema: ContractSchema<T>,
    fallbackCode: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('accept', 'application/json')
    const response = await this.transport.fetch(this.resolve(path), {
      credentials: 'include',
      ...init,
      headers,
    })
    if (!response.ok) {
      throw new ProductApiClientError(response, await this.parseError(response), fallbackCode)
    }
    return schema.parse(await response.json())
  }

  private jsonInit(method: string, value: unknown): RequestInit {
    return {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(value),
    }
  }

  bootstrapSession() {
    return this.request('/v1/session/bootstrap', sessionBootstrapSchema, 'SESSION_BOOTSTRAP_FAILED')
  }

  getProfile() {
    return this.request('/v1/profile', productProfileSchema, 'PROFILE_LOAD_FAILED')
  }

  updateProfile(input: UpdateProductProfile) {
    return this.request('/v1/profile', productProfileSchema, 'PROFILE_UPDATE_FAILED', this.jsonInit('PATCH', input))
  }

  getProductState() {
    return this.request('/v1/product-state', productStateSnapshotSchema, 'PRODUCT_STATE_LOAD_FAILED')
  }

  updateProductPreferences(patch: Partial<ProductStateSnapshotResponse['preferences']>) {
    return this.request('/v1/product-state', productPreferencesSchema, 'PRODUCT_PREFERENCES_UPDATE_FAILED', this.jsonInit('PATCH', patch))
  }

  getSpaces(locale: string) {
    return this.request(`/v1/spaces?locale=${encodeURIComponent(locale)}`, atmosphereSpaceDirectorySchema, 'SPACE_DIRECTORY_LOAD_FAILED')
  }

  setFavoriteSpace(spaceId: string, favorite: boolean) {
    return this.request(
      `/v1/spaces/${encodeURIComponent(spaceId)}/favorite`,
      updateSpaceFavoriteResponseSchema,
      'SPACE_FAVORITE_UPDATE_FAILED',
      this.jsonInit('PUT', { favorite }),
    )
  }

  getSocialSnapshot() {
    return this.request('/v1/contacts', socialSnapshotSchema, 'SOCIAL_SNAPSHOT_FAILED')
  }

  searchUsers(query: string): Promise<SocialPerson[]> {
    return this.request(
      `/v1/users/search?q=${encodeURIComponent(query)}`,
      userSearchResponseSchema,
      'USER_SEARCH_FAILED',
    ).then((result) => result.users)
  }

  async sendFriendRequest(recipientUserId: string) {
    await this.request('/v1/friend-requests', friendRequestMutationResponseSchema, 'FRIEND_REQUEST_FAILED', this.jsonInit('POST', { recipientUserId }))
  }

  async acceptFriendRequest(requestId: string) {
    await this.request(`/v1/friend-requests/${encodeURIComponent(requestId)}/accept`, socialMutationStatusSchema, 'FRIEND_REQUEST_ACCEPT_FAILED', this.jsonInit('POST', {}))
  }

  async rejectFriendRequest(requestId: string) {
    await this.request(`/v1/friend-requests/${encodeURIComponent(requestId)}/reject`, socialMutationStatusSchema, 'FRIEND_REQUEST_REJECT_FAILED', this.jsonInit('POST', {}))
  }

  async updateContactRemark(userId: string, remark: string | null) {
    await this.requestWithoutBody(`/v1/contacts/${encodeURIComponent(userId)}`, 'CONTACT_REMARK_UPDATE_FAILED', this.jsonInit('PATCH', { remark }))
  }

  async blockUser(userId: string) {
    await this.request('/v1/blocks', socialMutationStatusSchema, 'SOCIAL_BLOCK_FAILED', this.jsonInit('POST', { userId }))
  }

  async unblockUser(userId: string) {
    await this.requestWithoutBody(`/v1/blocks/${encodeURIComponent(userId)}`, 'SOCIAL_UNBLOCK_FAILED', { method: 'DELETE' })
  }

  createRoom(input: CreateRoomRequest) {
    return this.request('/v1/rooms', roomBootstrapSchema, 'ROOM_CREATE_FAILED', this.jsonInit('POST', input))
  }

  lookupRoomMetadata(matrixRoomIds: string[]) {
    return this.request('/v1/rooms/metadata', roomMetadataLookupResponseSchema, 'ROOM_METADATA_LOOKUP_FAILED', this.jsonInit('POST', { matrixRoomIds }))
  }

  updateRoomPreference(matrixRoomId: string, input: { pinned: boolean; muted: boolean }) {
    return this.request(
      `/v1/rooms/${encodeURIComponent(matrixRoomId)}/preferences`,
      productRoomPreferenceSchema,
      'ROOM_PREFERENCE_UPDATE_FAILED',
      this.jsonInit('PUT', input),
    )
  }

  getSpaceRuntime(matrixRoomId: string) {
    return this.request(
      `/v1/spaces/instances/${encodeURIComponent(matrixRoomId)}`,
      spaceRuntimeSnapshotSchema,
      'SPACE_RUNTIME_LOAD_FAILED',
    )
  }

  createSpaceAgentTurn(matrixRoomId: string, input: CreateSpaceAgentTurnRequest) {
    return this.request(
      `/v1/spaces/instances/${encodeURIComponent(matrixRoomId)}/turns`,
      spaceTurnAcceptedSchema,
      'SPACE_AGENT_TURN_FAILED',
      this.jsonInit('POST', input),
    )
  }

  publishSpaceApp(matrixRoomId: string, input: PublishSpaceAppRequest) {
    return this.request(
      `/v1/spaces/instances/${encodeURIComponent(matrixRoomId)}/publish`,
      spaceTurnAcceptedSchema,
      'SPACE_APP_PUBLISH_FAILED',
      this.jsonInit('POST', input),
    )
  }

  restoreSpaceApp(matrixRoomId: string, input: RestoreSpaceAppRequest) {
    return this.request(
      `/v1/spaces/instances/${encodeURIComponent(matrixRoomId)}/restore`,
      spaceTurnAcceptedSchema,
      'SPACE_APP_RESTORE_FAILED',
      this.jsonInit('POST', input),
    )
  }

  applySpaceTemplate(matrixRoomId: string, input: ApplySpaceTemplateRequest) {
    return this.request(
      `/v1/rooms/${encodeURIComponent(matrixRoomId)}/apply-template`,
      spaceTurnAcceptedSchema,
      'SPACE_TEMPLATE_APPLY_FAILED',
      this.jsonInit('POST', input),
    )
  }

  sendSpaceAppCommand(matrixRoomId: string, input: SpaceAppBridgeRequest) {
    return this.request(
      `/v1/spaces/instances/${encodeURIComponent(matrixRoomId)}/bridge`,
      spaceAppBridgeResponseSchema,
      'SPACE_APP_COMMAND_FAILED',
      this.jsonInit('POST', input),
    )
  }

  spaceEventsUrl(matrixRoomId: string) {
    return this.resolve(
      `/v1/spaces/instances/${encodeURIComponent(matrixRoomId)}/events`,
    ).toString()
  }

  spaceAppUrl(matrixRoomId: string, channel: 'dev' | 'live' = 'dev') {
    return this.resolve(
      `/v1/spaces/instances/${encodeURIComponent(matrixRoomId)}/app?channel=${channel}`,
    ).toString()
  }

  async uploadImage(file: File, provider?: 'oss' | 's3' | 'r2' | 'cos') {
    const body = new FormData()
    body.append('file', file)
    if (provider) body.append('provider', provider)
    const response = await this.transport.fetch(this.resolve('/api/upload'), {
      method: 'POST',
      credentials: 'include',
      body,
    })
    if (!response.ok) throw new ProductApiClientError(response, null, 'AVATAR_UPLOAD_FAILED')
    return uploadImageResponseSchema.parse(await response.json()).data
  }

  getPricingPlans(locale: string) {
    return this.request(`/api/pricing/plans?locale=${encodeURIComponent(locale)}`, pricingPlansResponseSchema, 'PRICING_LOAD_FAILED')
  }

  getCreditStatus() {
    return this.request('/api/credits/status', creditStatusResponseSchema, 'CREDIT_STATUS_FAILED')
  }

  getCreditTransactions(page = 1, limit = 10) {
    return this.request(`/api/credits/transactions?page=${page}&limit=${limit}`, creditTransactionsResponseSchema, 'CREDIT_TRANSACTIONS_FAILED')
  }

  getOrders(page = 1, limit = 10) {
    return this.request(`/api/orders?page=${page}&limit=${limit}`, ordersResponseSchema, 'ORDERS_FAILED')
  }

  getSubscriptionStatus() {
    return this.request('/api/subscription/status', subscriptionStatusResponseSchema, 'SUBSCRIPTION_STATUS_FAILED')
  }

  createSubscriptionPortal(provider?: string, returnUrl?: string) {
    return this.request('/api/subscription/portal', subscriptionPortalResponseSchema, 'SUBSCRIPTION_PORTAL_FAILED', this.jsonInit('POST', { provider, returnUrl }))
  }

  getAffiliateStats() {
    return this.request('/api/affiliate/stats', affiliateStatsResponseSchema, 'AFFILIATE_STATS_FAILED')
  }

  getCommissions(page = 1, limit = 10) {
    return this.request(`/api/affiliate/commissions?page=${page}&limit=${limit}`, commissionsResponseSchema, 'COMMISSIONS_FAILED')
  }

  getReferrals(page = 1, limit = 10) {
    return this.request(`/api/affiliate/referrals?page=${page}&limit=${limit}`, referralsResponseSchema, 'REFERRALS_FAILED')
  }

  getWithdrawals(page = 1, limit = 10) {
    return this.request(`/api/withdrawal/history?page=${page}&limit=${limit}`, withdrawalsResponseSchema, 'WITHDRAWALS_FAILED')
  }

  requestWithdrawal(input: WithdrawalRequestInput) {
    return this.request('/api/withdrawal/request', withdrawalRequestResponseSchema, 'WITHDRAWAL_REQUEST_FAILED', this.jsonInit('POST', withdrawalRequestInputSchema.parse(input)))
  }

  initiatePayment(input: PaymentInitiateInput) {
    return this.request('/api/payment/initiate', paymentInitiateResponseSchema, 'PAYMENT_INITIATE_FAILED', this.jsonInit('POST', paymentInitiateInputSchema.parse(input)))
  }

  generateImage(input: ImageGenerationInput) {
    return this.request('/api/image-generate', imageGenerationResponseSchema, 'IMAGE_GENERATION_FAILED', this.jsonInit('POST', imageGenerationInputSchema.parse(input)))
  }

  generateVideo(input: VideoGenerationInput) {
    return this.request('/api/video-generate', videoGenerationResponseSchema, 'VIDEO_GENERATION_FAILED', this.jsonInit('POST', videoGenerationInputSchema.parse(input)))
  }

  getVideoTask(taskId: string) {
    return this.request(`/api/video-generate/status?taskId=${encodeURIComponent(taskId)}`, videoTaskStatusResponseSchema, 'VIDEO_STATUS_FAILED')
  }

  private async requestWithoutBody(path: string, fallbackCode: string, init: RequestInit) {
    const response = await this.transport.fetch(this.resolve(path), {
      credentials: 'include',
      ...init,
    })
    if (!response.ok) {
      throw new ProductApiClientError(response, await this.parseError(response), fallbackCode)
    }
  }
}

import {
  atmosphereSpaceDirectorySchema,
  friendRequestMutationResponseSchema,
  productApiErrorSchema,
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
      const raw = await response.json().catch(() => null)
      const parsed = productApiErrorSchema.safeParse(raw)
      throw new ProductApiClientError(response, parsed.success ? parsed.data : null, fallbackCode)
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

  async uploadImage(file: File) {
    const body = new FormData()
    body.append('file', file)
    const response = await this.transport.fetch(this.resolve('/api/upload'), {
      method: 'POST',
      credentials: 'include',
      body,
    })
    if (!response.ok) throw new ProductApiClientError(response, null, 'AVATAR_UPLOAD_FAILED')
    return uploadImageResponseSchema.parse(await response.json()).data
  }

  private async requestWithoutBody(path: string, fallbackCode: string, init: RequestInit) {
    const response = await this.transport.fetch(this.resolve(path), {
      credentials: 'include',
      ...init,
    })
    if (!response.ok) {
      const raw = await response.json().catch(() => null)
      const parsed = productApiErrorSchema.safeParse(raw)
      throw new ProductApiClientError(response, parsed.success ? parsed.data : null, fallbackCode)
    }
  }
}

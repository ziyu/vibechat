import { describe, expect, it } from 'vitest'
import type {
  ProductRoomPreference,
  ProductStateRepository,
  ProductStateSnapshot,
  ProductUserPreferences,
} from '@libs/product-state'
import { ProductStateError, ProductStateService } from '@libs/product-state'
import { publishedSpaceTemplateCatalog, type PublishedSpaceTemplateCatalogEntry } from '@config'

class MemoryProductStateRepository implements ProductStateRepository {
  snapshots = new Map<string, ProductStateSnapshot>()
  favoriteUsers = new Map<string, Set<string>>()

  async getSnapshot(userId: string) {
    return this.snapshots.get(userId) || {
      preferences: { notificationsEnabled: true, theme: 'system' as const, locale: 'en' as const },
      roomPreferences: [],
      favoriteSpaceIds: [],
    }
  }

  async getSpaceFavoriteCounts() {
    const counts: Record<string, number> = {}
    for (const favorites of this.favoriteUsers.values()) {
      for (const spaceId of favorites) counts[spaceId] = (counts[spaceId] || 0) + 1
    }
    return counts
  }

  async upsertPreferences(userId: string, preferences: ProductUserPreferences) {
    const snapshot = await this.getSnapshot(userId)
    this.snapshots.set(userId, { ...snapshot, preferences })
    return preferences
  }

  async upsertRoomPreference(userId: string, preference: ProductRoomPreference) {
    const snapshot = await this.getSnapshot(userId)
    this.snapshots.set(userId, {
      ...snapshot,
      roomPreferences: [
        ...snapshot.roomPreferences.filter((item) => item.matrixRoomId !== preference.matrixRoomId),
        preference,
      ],
    })
    return preference
  }

  async setSpaceFavorite(userId: string, spaceId: string, favorite: boolean) {
    const favorites = this.favoriteUsers.get(userId) || new Set<string>()
    if (favorite) favorites.add(spaceId)
    else favorites.delete(spaceId)
    this.favoriteUsers.set(userId, favorites)
    const snapshot = await this.getSnapshot(userId)
    this.snapshots.set(userId, { ...snapshot, favoriteSpaceIds: [...favorites] })
  }
}

function createService(
  accessibleRooms: Record<string, string[]> = {},
  templates?: readonly PublishedSpaceTemplateCatalogEntry[],
) {
  const repository = new MemoryProductStateRepository()
  const service = new ProductStateService({
    repository,
    rooms: {
      getAccessibleByMatrixRoomIds: async (userId, roomIds) => roomIds
        .filter((roomId) => accessibleRooms[userId]?.includes(roomId))
        .map((matrixRoomId) => ({ matrixRoomId })),
    },
    templates,
    now: () => new Date('2026-08-12T08:00:00.000Z'),
  })
  return { repository, service }
}

describe('ProductStateService', () => {
  it('localizes the published Template directory and marks official publishers', async () => {
    const { repository, service } = createService()
    await service.setSpaceFavorite('user-a', 'space-campfire', true)
    await service.setSpaceFavorite('user-b', 'space-campfire', true)

    const directory = await service.getSpaceDirectory('zh-CN')
    expect(directory).toHaveLength(5)
    expect(directory.find((space) => space.id === 'space-campfire')).toMatchObject({
      schemaVersion: 'vibechat.space-template-market-entry/v1',
      id: 'space-campfire',
      name: '夜航电台',
      versionId: 'tplv-space-campfire-0-1-0',
      semanticVersion: '0.1.0',
      sourceHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      manifestHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      artifact: {
        schemaVersion: 'vibechat.space-template-artifact/v1',
        id: expect.stringMatching(/^tpla-[a-f0-9]{64}$/),
        format: 'agentos-app-v1',
        sourceHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      },
      projectFormat: 'agentos-app-v1',
      compatibility: {
        spaceAppSdk: 'v1',
        runtime: 'agentos-apps-0.2',
      },
      provenance: {
        origin: 'repository',
        publisherId: 'publisher-vibechat',
      },
      publisher: {
        id: 'publisher-vibechat',
        verification: 'official',
      },
      favoriteCount: 2,
    })
    expect(await repository.getSnapshot('user-a')).toMatchObject({
      favoriteSpaceIds: ['space-campfire'],
    })
  })

  it('accepts an App-published user Template through the identical catalog shape', async () => {
    const communityTemplate: PublishedSpaceTemplateCatalogEntry = {
      ...publishedSpaceTemplateCatalog[0],
      id: 'template-user-garden',
      versionId: 'tplv-user-garden-1-0-0',
      publisher: {
        id: 'user-alice',
        displayName: 'Alice',
        verification: 'unverified',
      },
      provenance: {
        origin: 'app',
        publisherId: 'user-alice',
        sourceSpaceRevisionId: 'revision-space-alice-42',
      },
    }
    const { service } = createService({}, [communityTemplate])

    await service.setSpaceFavorite('user-a', communityTemplate.id, true)
    await expect(service.getSpaceDirectory('en')).resolves.toMatchObject([{
      id: communityTemplate.id,
      publisher: communityTemplate.publisher,
      provenance: communityTemplate.provenance,
    }])
  })

  it('persists user-scoped preferences and only accepts accessible rooms', async () => {
    const { service } = createService({ 'user-a': ['!room:localhost'] })
    await service.updatePreferences(
      'user-a',
      { notificationsEnabled: true, theme: 'system', locale: 'en' },
      { notificationsEnabled: false, theme: 'dark', locale: 'zh-CN' },
    )
    await service.updateRoomPreference('user-a', {
      matrixRoomId: '!room:localhost',
      pinned: true,
      muted: true,
    })

    await expect(service.getSnapshot('user-a')).resolves.toMatchObject({
      preferences: { notificationsEnabled: false, theme: 'dark', locale: 'zh-CN' },
      roomPreferences: [{ matrixRoomId: '!room:localhost', pinned: true, muted: true }],
    })
    await expect(service.getSnapshot('user-b')).resolves.toMatchObject({
      preferences: { notificationsEnabled: true, theme: 'system', locale: 'en' },
      roomPreferences: [],
      favoriteSpaceIds: [],
    })
    await expect(service.updateRoomPreference('user-b', {
      matrixRoomId: '!room:localhost',
      pinned: true,
      muted: true,
    })).rejects.toEqual(expect.objectContaining<Partial<ProductStateError>>({
      code: 'PRODUCT_ROOM_NOT_FOUND',
    }))
  })

  it('rejects favorites outside the published catalog', async () => {
    const { service } = createService()
    await expect(service.setSpaceFavorite('user-a', 'market-space-not-published', true))
      .rejects.toEqual(expect.objectContaining<Partial<ProductStateError>>({
        code: 'PRODUCT_SPACE_NOT_FOUND',
      }))
  })
})

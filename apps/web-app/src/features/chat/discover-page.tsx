'use client'

import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowUpRight, Check, Heart, Search, ShieldCheck, Sparkles } from 'lucide-react'
import type { SpaceCategory } from '@libs/chat'
import { useTranslation } from '@/hooks/use-translation'
import { useChat } from './chat-store'
import { SpaceGlyph } from './chat-primitives'
import { NewChatDialog } from './new-chat-dialog'

const categories: Array<'all' | SpaceCategory> = ['all', 'daily', 'focus', 'play', 'ritual']

export function DiscoverPage({ spaceId }: { spaceId?: string }) {
  const { t, locale } = useTranslation()
  const { state, toggleFavoriteSpace } = useChat()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | SpaceCategory>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const selectedSpace = state.spaces.find((space) => space.id === spaceId)

  const spaces = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return state.spaces.filter(
      (space) =>
        (category === 'all' || space.category === category) &&
        (!normalized ||
          `${space.name} ${space.author} ${space.summary}`
            .toLocaleLowerCase()
            .includes(normalized)),
    )
  }, [category, query, state.spaces])

  if (selectedSpace) {
    const favorite = state.favoriteSpaceIds.includes(selectedSpace.id)
    return (
      <section className="vc-space-detail" data-testid="space-detail">
        <header>
          <Link
            to="/$lang/discover"
            params={{ lang: locale }}
            className="vc-back-link"
          >
            <ArrowLeft size={16} />
            {t.chatApp.discover.backToDiscover}
          </Link>
          <button
            type="button"
            className="vc-favorite-button"
            data-active={favorite || undefined}
            aria-pressed={favorite}
            onClick={() => void toggleFavoriteSpace(selectedSpace.id)}
          >
            <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
            {favorite ? t.chatApp.discover.saved : t.chatApp.discover.save}
          </button>
        </header>

        <div className="vc-space-detail-grid">
          <div
            className="vc-space-preview-stage"
            style={{ '--preview-accent': selectedSpace.accent, '--preview-canvas': selectedSpace.canvas } as React.CSSProperties}
          >
            <span>{selectedSpace.icon}</span>
            <i />
            <i />
            <div>
              <small>{t.chatApp.discover.sandboxPreview}</small>
              <strong>{selectedSpace.name}</strong>
            </div>
          </div>
          <div className="vc-space-detail-copy">
            <span className="vc-kicker">
              {selectedSpace.official ? t.chatApp.discover.official : t.chatApp.discover.community}
            </span>
            <h1>{selectedSpace.name}</h1>
            <p className="vc-space-author">{t.chatApp.discover.by.replace('{author}', selectedSpace.author)}</p>
            <p className="vc-space-summary">{selectedSpace.summary}</p>
            <div className="vc-space-trust-grid">
              <article>
                <ShieldCheck size={17} />
                <span>
                  <small>{t.chatApp.discover.permissions}</small>
                  <strong>
                    {t.chatApp.discover.permissionCount.replace(
                      '{count}',
                      selectedSpace.permissions.length.toString(),
                    )}
                  </strong>
                </span>
              </article>
              <article>
                <Check size={17} />
                <span>
                  <small>{t.chatApp.discover.externalNetwork}</small>
                  <strong>
                    {selectedSpace.networkDomains.length
                      ? selectedSpace.networkDomains.join(', ')
                      : t.chatApp.discover.noExternalNetwork}
                  </strong>
                </span>
              </article>
            </div>
            <button
              type="button"
              className="vc-button vc-button-primary vc-use-space-button"
              onClick={() => setCreateOpen(true)}
            >
              {t.chatApp.discover.useThisSpace}
              <ArrowUpRight size={16} />
            </button>
          </div>
        </div>

        <NewChatDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          initialSpaceId={selectedSpace.id}
        />
      </section>
    )
  }

  return (
    <section className="vc-discover-page" data-testid="discover-page">
      <header className="vc-discover-header">
        <div>
          <span className="vc-kicker">{t.chatApp.discover.kicker}</span>
          <h1>{t.chatApp.discover.title}</h1>
          <p>{t.chatApp.discover.description}</p>
        </div>
        <label className="vc-search-field vc-discover-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.chatApp.discover.searchPlaceholder}
          />
        </label>
      </header>

      <nav className="vc-category-tabs" aria-label={t.chatApp.discover.categoryLabel}>
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            data-active={category === item || undefined}
            onClick={() => setCategory(item)}
          >
            {t.chatApp.discover.categories[item]}
          </button>
        ))}
      </nav>

      <div className="vc-space-gallery">
        {spaces.map((space, index) => {
          const favorite = state.favoriteSpaceIds.includes(space.id)
          return (
            <article key={space.id} className="vc-space-card" data-testid="space-card">
              <Link
                to="/$lang/discover/spaces/$spaceId"
                params={{ lang: locale, spaceId: space.id }}
                className="vc-space-card-preview"
                style={{ '--preview-accent': space.accent, '--preview-canvas': space.canvas } as React.CSSProperties}
              >
                <span className="vc-space-number">0{index + 1}</span>
                <span className="vc-space-card-symbol">{space.icon}</span>
                <i />
                <span className="vc-space-card-badge">
                  {space.official ? t.chatApp.discover.official : t.chatApp.discover.community}
                </span>
              </Link>
              <div className="vc-space-card-copy">
                <SpaceGlyph space={space} />
                <span>
                  <small>{space.author}</small>
                  <h2>{space.name}</h2>
                  <p>{space.summary}</p>
                </span>
                <button
                  type="button"
                  className="vc-card-favorite"
                  aria-label={favorite ? t.chatApp.discover.unsave : t.chatApp.discover.save}
                  aria-pressed={favorite}
                  onClick={() => void toggleFavoriteSpace(space.id)}
                >
                  <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {!spaces.length ? (
        <div className="vc-gallery-empty">
          <Sparkles size={22} />
          <h2>{t.chatApp.discover.noResults}</h2>
          <p>{t.chatApp.discover.noResultsDescription}</p>
        </div>
      ) : null}
    </section>
  )
}

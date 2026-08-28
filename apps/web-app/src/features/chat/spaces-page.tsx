'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ArrowUpRight, DoorOpen, Plus, Search, Sparkles, UsersRound, X } from 'lucide-react'
import { formatRoomTime, sortRooms } from '@vibechat/product-core'
import { useTranslation } from '@/hooks/use-translation'
import { useChat } from './chat-store'
import { EmptyState, SpaceGlyph } from './chat-primitives'
import { NewSpaceDialog } from './new-space-dialog'
import { SpaceRail } from './space-rail'

export function SpacesPage() {
  const { t, locale } = useTranslation()
  const { state, markRoomRead } = useChat()
  const locationHash = useRouterState({ select: (routerState) => routerState.location.hash })
  const [createOpen, setCreateOpen] = useState(false)
  const [finderOpen, setFinderOpen] = useState(locationHash === 'finder')
  const finderPanelRef = useRef<HTMLElement>(null)
  const finderTriggerRef = useRef<HTMLButtonElement | null>(null)
  const rooms = sortRooms(state.rooms)
  const corridorRooms = rooms.flatMap((room) => {
    const space = state.spaces.find((candidate) => candidate.id === room.spaceId)
    if (!space) return []
    const members = room.memberIds
      .map((id) => state.people.find((person) => person.id === id))
      .filter((person): person is NonNullable<typeof person> => !!person)
    return [{ room, space, members }]
  })

  useEffect(() => {
    if (locationHash === 'finder') setFinderOpen(true)
  }, [locationHash])

  const closeFinder = useCallback(() => {
    setFinderOpen(false)
    if (window.location.hash === '#finder') {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
  }, [])

  const openFinder = (event?: ReactMouseEvent<HTMLButtonElement>) => {
    finderTriggerRef.current = event?.currentTarget || null
    setFinderOpen(true)
  }

  useEffect(() => {
    if (!finderOpen) return
    const panel = finderPanelRef.current
    const selector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    const frame = window.requestAnimationFrame(() => {
      panel?.querySelector<HTMLElement>(selector)?.focus()
    })
    const containFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeFinder()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(selector))
      if (!focusable.length) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', containFocus)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', containFocus)
      finderTriggerRef.current?.focus()
    }
  }, [closeFinder, finderOpen])

  return (
    <div className="vc-spaces-layout" data-testid="spaces-overview">
      <section
        className="vc-corridor-shell"
        inert={finderOpen ? true : undefined}
        aria-hidden={finderOpen ? true : undefined}
      >
        <header className="vc-corridor-header">
          <div>
            <strong>{t.chatApp.spaces.title}</strong>
            <small>{t.chatApp.spaces.headerSubtitle}</small>
          </div>
          <span className="vc-live-indicator">
            <i /> {t.chatApp.spaces.activitySynced}
          </span>
          <button
            type="button"
            className="vc-corridor-finder-button"
            onClick={openFinder}
          >
            <Search size={16} />
            {t.chatApp.spaces.openFinder}
          </button>
        </header>

        <main className="vc-room-corridor">
          <section className="vc-corridor-intro">
            <h1>{t.chatApp.spaces.heroTitle}</h1>
            <p>{t.chatApp.spaces.heroDescription}</p>
          </section>

          {corridorRooms.length > 0 ? (
            <section className="vc-space-cover-grid" aria-label={t.chatApp.spaces.title}>
              {corridorRooms.map(({ room, space, members }) => (
                <Link
                  key={room.id}
                  to="/spaces/$spaceId"
                  params={{ spaceId: room.id }}
                  className="vc-space-cover-card"
                  data-unread={room.unreadCount > 0 || undefined}
                  data-testid="space-card"
                  onClick={() => markRoomRead(room.id)}
                  style={{
                    '--room-accent': space.accent,
                    '--room-canvas': space.canvas,
                  } as CSSProperties}
                >
                  <span className="vc-space-cover-image" data-testid="space-cover" aria-hidden="true">
                    <span className="vc-space-cover-mark">
                      <SpaceGlyph space={space} />
                    </span>
                  </span>
                  <span className="vc-space-cover-copy">
                    <span>
                      <strong>{room.name}</strong>
                      <small>
                        <UsersRound size={12} />
                        {members.length}
                        <span aria-hidden="true">·</span>
                        <time dateTime={room.updatedAt}>{formatRoomTime(room.updatedAt, locale)}</time>
                      </small>
                    </span>
                    {room.unreadCount > 0 ? <i>{room.unreadCount}</i> : null}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </section>
          ) : (
            <EmptyState
              icon={<DoorOpen size={22} />}
              title={t.chatApp.spaces.emptyTitle}
              description={t.chatApp.spaces.emptyDescription}
              action={(
                <button type="button" className="vc-button vc-button-primary" onClick={() => setCreateOpen(true)}>
                  <Plus size={15} /> {t.chatApp.spaces.newSpace}
                </button>
              )}
            />
          )}

          <footer className="vc-corridor-threshold">
            <Link to="/discover">
              <Sparkles size={16} />
              <span>
                <strong>{t.chatApp.spaces.browseTemplates}</strong>
                <small>{t.chatApp.spaces.browseTemplatesDescription}</small>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              data-testid="create-space-hero"
            >
              <Plus size={18} />
              <span>
                <strong>{t.chatApp.spaces.createCardTitle}</strong>
                <small>{t.chatApp.spaces.createCardDescription}</small>
              </span>
            </button>
          </footer>
        </main>
      </section>

      {finderOpen ? (
        <div className="vc-space-finder">
          <button type="button" tabIndex={-1} className="vc-space-finder-scrim" onClick={closeFinder} aria-label={t.chatApp.spaces.closeFinder} />
          <section
            ref={finderPanelRef}
            className="vc-space-finder-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t.chatApp.spaces.openFinder}
            tabIndex={-1}
          >
            <button type="button" className="vc-space-finder-close" onClick={closeFinder} aria-label={t.chatApp.spaces.closeFinder}>
              <X size={18} />
            </button>
            <SpaceRail />
          </section>
        </div>
      ) : null}

      <NewSpaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

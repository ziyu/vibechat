'use client'

import { useMemo, useState } from 'react'
import {
  Check,
  MessageCircleMore,
  Search,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import { useChatDemo } from './chat-store'
import { PersonAvatar, SpaceGlyph } from './chat-primitives'
import { NewChatDialog } from './new-chat-dialog'

export function ContactsPage() {
  const { t } = useTranslation()
  const {
    state,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useChatDemo()
  const [query, setQuery] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState(state.contactIds[0])
  const [createOpen, setCreateOpen] = useState(false)
  const [createPersonId, setCreatePersonId] = useState<string>()

  const contacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return state.contactIds
      .map((id) => state.people.find((person) => person.id === id))
      .filter((person): person is NonNullable<typeof person> => !!person)
      .filter(
        (person) =>
          !normalized ||
          `${person.displayName} ${person.handle} ${person.bio}`
            .toLocaleLowerCase()
            .includes(normalized),
      )
  }, [query, state.contactIds, state.people])
  const selectedPerson = state.people.find((person) => person.id === selectedPersonId)
  const selectedRooms = selectedPerson
    ? state.rooms.filter((room) => room.memberIds.includes(selectedPerson.id))
    : []

  const startChat = (personId: string) => {
    setCreatePersonId(personId)
    setCreateOpen(true)
  }

  return (
    <div className="vc-directory-layout" data-testid="contacts-page">
      <section className="vc-directory-list">
        <header className="vc-page-heading">
          <span className="vc-kicker">{t.chatApp.contacts.kicker}</span>
          <h1>{t.chatApp.contacts.title}</h1>
          <p>{t.chatApp.contacts.description}</p>
        </header>

        <label className="vc-search-field vc-directory-search">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.chatApp.contacts.searchPlaceholder}
          />
        </label>

        {state.friendRequests.length ? (
          <section className="vc-request-section">
            <header>
              <span>{t.chatApp.contacts.requests}</span>
              <i>{state.friendRequests.length}</i>
            </header>
            {state.friendRequests.map((request) => {
              const person = state.people.find((candidate) => candidate.id === request.personId)!
              return (
                <article key={request.id} className="vc-friend-request" data-testid="friend-request">
                  <PersonAvatar person={person} showPresence />
                  <span>
                    <strong>{person.displayName}</strong>
                    <small>{t.chatApp.contacts.requestedToConnect}</small>
                  </span>
                  <button
                    type="button"
                    className="vc-icon-button vc-accept-button"
                    aria-label={t.chatApp.contacts.accept}
                    onClick={() => acceptFriendRequest(request.id)}
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    className="vc-icon-button"
                    aria-label={t.chatApp.contacts.reject}
                    onClick={() => rejectFriendRequest(request.id)}
                  >
                    <X size={15} />
                  </button>
                </article>
              )
            })}
          </section>
        ) : null}

        <section className="vc-contact-list">
          <header>
            <span>{t.chatApp.contacts.allContacts}</span>
            <i>{contacts.length}</i>
          </header>
          {contacts.map((person) => (
            <button
              key={person.id}
              type="button"
              className="vc-contact-row"
              data-active={person.id === selectedPersonId || undefined}
              onClick={() => setSelectedPersonId(person.id)}
            >
              <PersonAvatar person={person} showPresence />
              <span>
                <strong>{person.displayName}</strong>
                <small>{person.handle}</small>
              </span>
              <i data-presence={person.presence}>
                {t.chatApp.presence[person.presence]}
              </i>
            </button>
          ))}
        </section>
      </section>

      <section className="vc-contact-detail">
        {selectedPerson ? (
          <>
            <div className="vc-contact-hero">
              <span className="vc-contact-orbit" aria-hidden="true" />
              <PersonAvatar person={selectedPerson} size="xl" showPresence />
              <span className="vc-kicker">{t.chatApp.contacts.contactProfile}</span>
              <h2>{selectedPerson.displayName}</h2>
              <p>{selectedPerson.handle}</p>
              <blockquote>{selectedPerson.bio}</blockquote>
              <div>
                <button
                  type="button"
                  className="vc-button vc-button-primary"
                  onClick={() => startChat(selectedPerson.id)}
                >
                  <MessageCircleMore size={16} />
                  {t.chatApp.contacts.startChat}
                </button>
                <button
                  type="button"
                  className="vc-button vc-button-ghost"
                  onClick={() => startChat(selectedPerson.id)}
                >
                  <UserPlus size={16} />
                  {t.chatApp.contacts.addToGroup}
                </button>
              </div>
            </div>

            <section className="vc-shared-rooms">
              <header>
                <span>
                  <UsersRound size={15} />
                  {t.chatApp.contacts.sharedRooms}
                </span>
                <i>{selectedRooms.length}</i>
              </header>
              {selectedRooms.map((room) => {
                const space = state.spaces.find((candidate) => candidate.id === room.spaceId)!
                return (
                  <article key={room.id}>
                    <SpaceGlyph space={space} />
                    <span>
                      <strong>{room.name}</strong>
                      <small>{space.name}</small>
                    </span>
                    <MessageCircleMore size={16} />
                  </article>
                )
              })}
            </section>
          </>
        ) : null}
      </section>

      <NewChatDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialParticipantIds={createPersonId ? [createPersonId] : undefined}
      />
    </div>
  )
}

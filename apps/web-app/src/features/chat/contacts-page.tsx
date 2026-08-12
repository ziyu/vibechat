'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Ban,
  Check,
  MessageCircleMore,
  Pencil,
  Search,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import type { SocialPerson } from '@vibechat/api-contracts'
import { useChat } from './chat-store'
import { PersonAvatar, SpaceGlyph } from './chat-primitives'
import { NewChatDialog } from './new-chat-dialog'

export function ContactsPage() {
  const { t } = useTranslation()
  const {
    state,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    blockUser,
    updateContactRemark,
  } = useChat()
  const [query, setQuery] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState(state.contactIds[0])
  const [createOpen, setCreateOpen] = useState(false)
  const [createPersonId, setCreatePersonId] = useState<string>()
  const [searchResults, setSearchResults] = useState<SocialPerson[]>([])
  const [searching, setSearching] = useState(false)
  const [requestedIds, setRequestedIds] = useState<string[]>([])
  const [remarkEditing, setRemarkEditing] = useState(false)
  const [remarkValue, setRemarkValue] = useState('')
  const [remarkSaving, setRemarkSaving] = useState(false)
  const [remarkError, setRemarkError] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      void searchUsers(query).then((users) => {
        if (!cancelled) setSearchResults(users)
      }).finally(() => {
        if (!cancelled) setSearching(false)
      })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, searchUsers])

  useEffect(() => {
    if (selectedPersonId && state.contactIds.includes(selectedPersonId)) return
    setSelectedPersonId(state.contactIds[0])
  }, [selectedPersonId, state.contactIds])

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
    ? state.rooms.filter((room) => room.memberIds.includes(
        selectedPerson.matrixUserId || selectedPerson.id,
      ))
    : []

  const startChat = (personId: string) => {
    setCreatePersonId(personId)
    setCreateOpen(true)
  }

  const saveRemark = async (remark: string | null) => {
    if (!selectedPerson) return
    setRemarkSaving(true)
    setRemarkError(false)
    try {
      await updateContactRemark(selectedPerson.id, remark)
      setRemarkEditing(false)
    } catch {
      setRemarkError(true)
    } finally {
      setRemarkSaving(false)
    }
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
                    onClick={() => void acceptFriendRequest(request.id)}
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    className="vc-icon-button"
                    aria-label={t.chatApp.contacts.reject}
                    onClick={() => void rejectFriendRequest(request.id)}
                  >
                    <X size={15} />
                  </button>
                  <button
                    type="button"
                    className="vc-icon-button vc-danger-button"
                    aria-label={t.chatApp.contacts.block}
                    onClick={() => {
                      if (window.confirm(t.chatApp.contacts.blockConfirm)) {
                        void blockUser(person.id)
                      }
                    }}
                  >
                    <Ban size={14} />
                  </button>
                </article>
              )
            })}
          </section>
        ) : null}

        {query.trim().length >= 2 ? (
          <section className="vc-request-section" data-testid="user-search-results">
            <header>
              <span>{t.chatApp.contacts.searchResults}</span>
              <i>{searchResults.length}</i>
            </header>
            {searching ? <p>{t.chatApp.contacts.searching}</p> : null}
            {!searching && searchResults.length === 0 ? (
              <p>{t.chatApp.contacts.noUsersFound}</p>
            ) : null}
            {searchResults
              .filter((person) => !state.contactIds.includes(person.id))
              .map((person) => {
                const chatPerson = {
                  id: person.id,
                  matrixUserId: person.matrixUserId,
                  handle: `@${person.username}`,
                  displayName: person.displayName,
                  initials: [...(person.displayName || person.username)].slice(0, 2).join(''),
                  color: '#356b94',
                  presence: 'offline' as const,
                  bio: '',
                }
                const requested = requestedIds.includes(person.id)
                return (
                  <article
                    key={person.id}
                    className="vc-friend-request"
                    data-testid="user-search-result"
                    data-search-result
                  >
                    <PersonAvatar person={chatPerson} showPresence />
                    <span>
                      <strong>{person.displayName}</strong>
                      <small>@{person.username}</small>
                    </span>
                    <button
                      type="button"
                      className="vc-icon-button vc-accept-button"
                      aria-label={requested
                        ? t.chatApp.contacts.requestSent
                        : t.chatApp.contacts.addContact}
                      disabled={requested}
                      onClick={() => {
                        void sendFriendRequest(person.id).then(() => {
                          setRequestedIds((current) => [...current, person.id])
                        })
                      }}
                    >
                      {requested ? <Check size={15} /> : <UserPlus size={15} />}
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
              data-testid="contact-row"
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
              {remarkEditing ? (
                <form
                  className="vc-remark-editor"
                  data-testid="contact-remark-editor"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void saveRemark(remarkValue.trim() || null)
                  }}
                >
                  <label>
                    <span>{t.chatApp.contacts.remark}</span>
                    <input
                      value={remarkValue}
                      onChange={(event) => setRemarkValue(event.target.value)}
                      maxLength={50}
                      autoFocus
                      data-testid="contact-remark-input"
                    />
                  </label>
                  <div>
                    <button type="submit" disabled={remarkSaving} data-testid="save-contact-remark">
                      {remarkSaving ? t.chatApp.contacts.savingRemark : t.chatApp.contacts.saveRemark}
                    </button>
                    <button type="button" onClick={() => setRemarkEditing(false)}>
                      {t.chatApp.contacts.cancelRemark}
                    </button>
                    <button type="button" data-testid="clear-contact-remark" onClick={() => void saveRemark(null)}>
                      {t.chatApp.contacts.clearRemark}
                    </button>
                  </div>
                  {remarkError ? <small role="alert">{t.chatApp.contacts.remarkFailed}</small> : null}
                </form>
              ) : (
                <button
                  type="button"
                  className="vc-edit-remark"
                  data-testid="edit-contact-remark"
                  onClick={() => {
                    setRemarkValue(selectedPerson.displayName)
                    setRemarkError(false)
                    setRemarkEditing(true)
                  }}
                >
                  <Pencil size={12} />
                  {t.chatApp.contacts.editRemark}
                </button>
              )}
              <blockquote>{selectedPerson.bio}</blockquote>
              <div>
                <button
                  type="button"
                  className="vc-button vc-button-primary"
                  data-testid="start-chat-with-contact"
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
                <button
                  type="button"
                  className="vc-button vc-button-ghost vc-danger-button"
                  onClick={() => {
                    if (window.confirm(t.chatApp.contacts.blockConfirm)) {
                      void blockUser(selectedPerson.id)
                    }
                  }}
                >
                  <Ban size={16} />
                  {t.chatApp.contacts.blockContact}
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

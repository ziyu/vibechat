'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, LockKeyhole, Search, UsersRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@vibechat/react-shared/ui/dialog'
import { useTranslation } from '@/hooks/use-translation'
import { useChat } from './chat-store'
import { PersonAvatar, SpaceGlyph } from './chat-primitives'

export function NewSpaceDialog({
  open,
  onOpenChange,
  initialSpaceId,
  initialParticipantIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSpaceId?: string
  initialParticipantIds?: string[]
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { state, createRoom } = useChat()
  const [step, setStep] = useState(initialSpaceId ? 0 : 0)
  const [query, setQuery] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>(initialParticipantIds ?? [])
  const [spaceId, setSpaceId] = useState(initialSpaceId ?? 'space-default')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setQuery('')
    setParticipantIds(initialParticipantIds ?? [])
    setSpaceId(initialSpaceId ?? 'space-default')
    setCreating(false)
    setCreateError(false)
  }, [initialParticipantIds, initialSpaceId, open])

  const contacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return state.contactIds
      .map((id) => state.people.find((person) => person.id === id))
      .filter((person): person is NonNullable<typeof person> => !!person)
      .filter(
        (person) =>
          !normalized ||
          `${person.displayName} ${person.handle}`.toLocaleLowerCase().includes(normalized),
      )
  }, [query, state.contactIds, state.people])

  const selectedPeople = participantIds
    .map((id) => state.people.find((person) => person.id === id))
    .filter((person): person is NonNullable<typeof person> => !!person)
  const selectedSpace = state.spaces.find((space) => space.id === spaceId)

  const togglePerson = (personId: string) => {
    setParticipantIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    )
  }

  const handleCreate = async () => {
    if (!spaceId) return
    setCreating(true)
    setCreateError(false)
    try {
      const roomId = await createRoom({ participantIds, spaceId })
      onOpenChange(false)
      navigate({
        to: '/spaces/$spaceId',
        params: { spaceId: roomId },
      })
    } catch {
      setCreateError(true)
    } finally {
      setCreating(false)
    }
  }

  const titles = [
    t.chatApp.newSpace.peopleTitle,
    t.chatApp.newSpace.spaceTitle,
    t.chatApp.newSpace.reviewTitle,
  ]
  const descriptions = [
    t.chatApp.newSpace.peopleDescription,
    t.chatApp.newSpace.spaceDescription,
    t.chatApp.newSpace.reviewDescription,
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="vc-create-dialog"
        data-testid="new-space-dialog"
        aria-describedby="new-space-description"
      >
        <DialogHeader className="vc-create-header">
          <div className="vc-create-progress" aria-label={t.chatApp.newSpace.progressLabel}>
            {[0, 1, 2].map((index) => (
              <span key={index} data-current={index === step || undefined} data-complete={index < step || undefined}>
                {index < step ? <Check size={12} /> : index + 1}
              </span>
            ))}
          </div>
          <DialogTitle>{titles[step]}</DialogTitle>
          <DialogDescription id="new-space-description">
            {descriptions[step]}
          </DialogDescription>
        </DialogHeader>

        <div className="vc-create-body">
          {step === 0 ? (
            <>
              <label className="vc-search-field">
                <Search size={16} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.chatApp.newSpace.searchPeople}
                  autoFocus
                />
              </label>
              {selectedPeople.length ? (
                <div className="vc-selected-people" aria-label={t.chatApp.newSpace.selectedPeople}>
                  {selectedPeople.map((person) => (
                    <button key={person.id} type="button" onClick={() => togglePerson(person.id)}>
                      <PersonAvatar person={person} size="sm" />
                      <span>{person.displayName}</span>
                      <i>×</i>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="vc-picker-list">
                {contacts.map((person) => {
                  const selected = participantIds.includes(person.id)
                  return (
                    <button
                      key={person.id}
                      type="button"
                      className="vc-person-option"
                      data-selected={selected || undefined}
                      onClick={() => togglePerson(person.id)}
                    >
                      <PersonAvatar person={person} showPresence />
                      <span>
                        <strong>{person.displayName}</strong>
                        <small>{person.handle}</small>
                      </span>
                      <i>{selected ? <Check size={14} /> : null}</i>
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <div className="vc-space-picker">
              {state.spaces.map((space) => {
                const selected = space.id === spaceId
                return (
                  <button
                    key={space.id}
                    type="button"
                    className="vc-space-option"
                    data-selected={selected || undefined}
                    onClick={() => setSpaceId(space.id)}
                  >
                    <SpaceGlyph space={space} />
                    <span>
                      <strong>{space.name}</strong>
                      <small>{space.summary}</small>
                      <b className="vc-template-version">
                        {t.chatApp.newSpace.templateVersion.replace(
                          '{version}',
                          space.semanticVersion,
                        )}
                      </b>
                    </span>
                    <i>{selected ? <Check size={14} /> : null}</i>
                  </button>
                )
              })}
            </div>
          ) : null}

          {step === 2 && selectedSpace ? (
            <div className="vc-create-review">
              <div className="vc-review-summary">
                <SpaceGlyph space={selectedSpace} />
                <span>
                  <small>{t.chatApp.newSpace.template}</small>
                  <strong>{selectedSpace.name}</strong>
                  <em>
                    {selectedSpace.author} · {t.chatApp.newSpace.templateVersion.replace(
                      '{version}',
                      selectedSpace.semanticVersion,
                    )}
                  </em>
                </span>
              </div>
              <div className="vc-review-row">
                <UsersRound size={17} />
                <span>
                  <small>{t.chatApp.newSpace.participants}</small>
                  <strong>
                    {selectedPeople.length
                      ? selectedPeople.map((person) => person.displayName).join('、')
                      : t.chatApp.newSpace.justYou}
                  </strong>
                </span>
              </div>
              <div className="vc-review-row">
                <LockKeyhole size={17} />
                <span>
                  <small>{t.chatApp.newSpace.permissions}</small>
                  <strong>
                    {t.chatApp.newSpace.permissionSummary.replace(
                      '{count}',
                      selectedSpace.permissions.length.toString(),
                    )}
                  </strong>
                </span>
              </div>
              <p>
                {t.chatApp.newSpace.matrixNotice}
              </p>
              {createError ? <p role="alert">{t.chatApp.newSpace.createFailed}</p> : null}
            </div>
          ) : null}
        </div>

        <footer className="vc-create-footer">
          {step > 0 ? (
            <button type="button" className="vc-button vc-button-ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={15} />
              {t.actions.back}
            </button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <button
              type="button"
              className="vc-button vc-button-primary"
              disabled={step === 1 && !spaceId}
              onClick={() => setStep(step + 1)}
            >
              {t.actions.next}
            </button>
          ) : (
            <button
              type="button"
              className="vc-button vc-button-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? t.chatApp.newSpace.creating : t.chatApp.newSpace.create}
            </button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  )
}

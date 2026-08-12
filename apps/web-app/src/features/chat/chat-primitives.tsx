import type { AtmosphereSpace, ChatPerson } from '@libs/chat'
import { cn } from '@libs/ui'
import type { CSSProperties, ReactNode } from 'react'

export function PersonAvatar({
  person,
  size = 'md',
  showPresence = false,
}: {
  person: ChatPerson
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showPresence?: boolean
}) {
  return (
    <span
      className={cn('vc-avatar', `vc-avatar-${size}`)}
      style={{ '--avatar-color': person.color } as CSSProperties}
      aria-hidden="true"
    >
      {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <span>{person.initials}</span>}
      {showPresence ? <i data-presence={person.presence} /> : null}
    </span>
  )
}

export function AvatarStack({
  people,
  limit = 3,
}: {
  people: ChatPerson[]
  limit?: number
}) {
  return (
    <span className="vc-avatar-stack" aria-hidden="true">
      {people.slice(0, limit).map((person) => (
        <PersonAvatar key={person.id} person={person} size="sm" />
      ))}
      {people.length > limit ? <span className="vc-avatar-more">+{people.length - limit}</span> : null}
    </span>
  )
}

export function SpaceGlyph({
  space,
  className,
}: {
  space: AtmosphereSpace
  className?: string
}) {
  return (
    <span
      className={cn('vc-space-glyph', className)}
      style={
        {
          '--space-accent': space.accent,
          '--space-canvas': space.canvas,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {space.icon}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="vc-empty-state">
      <span className="vc-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

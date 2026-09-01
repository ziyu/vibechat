import type {
  DetailedHTMLProps,
  HTMLAttributes,
  Ref,
} from 'react'
import type {
  SpaceAgentActivityElement,
  SpaceChatComposerElement,
  SpaceChatTimelineElement,
  SpaceMemberListElement,
} from '@vibechat/space-app-components'

type SpaceElementProps<Element extends HTMLElement> =
  DetailedHTMLProps<HTMLAttributes<Element>, Element> & {
    locale?: string
    ref?: Ref<Element>
  }

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'vc-space-user-info-card': SpaceElementProps<HTMLElement> & {
        'user-id'?: string
        name?: string
        handle?: string
        presence?: string
      }
      'vc-space-member-list': SpaceElementProps<SpaceMemberListElement>
      'vc-space-agent-activity': SpaceElementProps<SpaceAgentActivityElement>
      'vc-space-chat-timeline': SpaceElementProps<SpaceChatTimelineElement>
      'vc-space-chat-composer': SpaceElementProps<SpaceChatComposerElement> & {
        maxlength?: string | number
      }
    }
  }
}

export {}

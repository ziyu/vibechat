export interface SpaceMember {
  id: string;
  clientId: string;
  name: string;
  displayName?: string;
  handle?: string;
  initials?: string;
  avatarUrl?: string | null;
}

export interface SpaceMentionTarget {
  id: string;
  handle: string;
  name: string;
  initials?: string;
  type: "member" | "agent";
  available?: boolean;
}

export interface SpaceMessage {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  createdAt: string;
  status: "sending" | "sent" | "failed";
  replyToId?: string;
  agent?: boolean;
  agentId?: string;
  edited?: boolean;
  deleted?: boolean;
  attachment?: Record<string, unknown>;
  reactions: Array<{ emoji: string; userIds: string[] }>;
}

export interface SpaceChatPermissions {
  readonly send: boolean;
  readonly attach: boolean;
  readonly reply: boolean;
  readonly editOwn: boolean;
  readonly deleteOwn: boolean;
  readonly react: boolean;
  readonly retryOwn: boolean;
  readonly typing: boolean;
  readonly markRead: boolean;
}

export interface SpaceSnapshot {
  locale: string;
  meta: {
    id: string;
    name: string;
    summary: string;
    icon: string;
    accent: string;
  };
  self: SpaceMember | null;
  members: SpaceMember[];
  mentions: SpaceMentionTarget[];
  chat: {
    messages: SpaceMessage[];
    typingMemberIds: string[];
    permissions: SpaceChatPermissions;
  };
  agent: {
    id?: string;
    name?: string;
    messages: Array<Record<string, unknown>>;
    build: Record<string, unknown> | null;
    queue: { activeCount: number; pendingCount: number };
  };
}

export interface SpaceSdk {
  readonly ready: Promise<unknown>;
  readonly locale: string;
  readonly snapshot: SpaceSnapshot;
  readonly self: SpaceMember | null;
  readonly members: SpaceMember[];
  readonly mentions: SpaceMentionTarget[];
  readonly meta: SpaceSnapshot["meta"];
  readonly agent: SpaceSnapshot["agent"];
  readonly chat: {
    readonly messages: SpaceMessage[];
    readonly typingMemberIds: string[];
    readonly permissions: SpaceChatPermissions;
    send(input: {
      text: string;
      replyToId?: string;
      mentionIds?: string[];
    }): Promise<unknown>;
    edit(messageId: string, text: string): Promise<unknown>;
    delete(messageId: string): Promise<unknown>;
    toggleReaction(messageId: string, emoji: string): Promise<unknown>;
    retry(messageId: string): Promise<unknown>;
    attach(file: File): Promise<unknown>;
    markRead(): Promise<unknown>;
    setTyping(value: boolean): Promise<unknown>;
  };
  readonly mention: {
    search(query?: string): SpaceMentionTarget[];
  };
  on(event: string, handler: (value: unknown) => void): () => void;
}

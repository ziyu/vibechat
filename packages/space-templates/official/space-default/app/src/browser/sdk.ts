export interface SpaceMember {
  id: string;
  name?: string;
  displayName?: string;
  handle?: string;
  initials?: string;
}

export interface SpaceMentionTarget extends SpaceMember {
  type: "member" | "agent";
  handle: string;
  name: string;
}

export interface SpaceAttachment {
  kind?: string;
  name: string;
  mimeType?: string;
  downloadUrl?: string;
}

export interface SpaceReaction {
  emoji: string;
  userIds?: string[];
}

export interface SpaceMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string | number;
  replyToId?: string;
  attachment?: SpaceAttachment;
  reactions?: SpaceReaction[];
  status?: "sending" | "sent" | "failed" | string;
  edited?: boolean;
  deleted?: boolean;
  agent?: boolean;
  agentId?: string;
}

export interface SpaceAgentMessage {
  id: string;
  type?: string;
  authorId?: string;
  text: string;
  createdAt: string | number;
}

export interface SpaceSdk {
  ready: Promise<unknown>;
  locale?: string;
  self?: SpaceMember;
  members: SpaceMember[];
  mentions: SpaceMentionTarget[];
  meta?: { name?: string; summary?: string; icon?: string };
  agent: {
    id?: string;
    name?: string;
    messages?: SpaceAgentMessage[];
    build?: { stage?: string } | null;
  };
  chat: {
    messages?: SpaceMessage[];
    typingMemberIds?: string[];
    send(input: { text: string; replyToId?: string; mentionIds?: string[] }): Promise<unknown>;
    edit(messageId: string, text: string): Promise<unknown>;
    delete(messageId: string): Promise<unknown>;
    toggleReaction(messageId: string, emoji?: string): Promise<unknown>;
    retry(messageId: string): Promise<unknown>;
    attach(file: File): Promise<unknown>;
    markRead(): Promise<unknown> | void;
    setTyping(value: boolean): Promise<unknown> | void;
  };
  mention: { search(query: string): SpaceMentionTarget[] };
  theme: { set(tokens: Record<string, string>): Promise<unknown> | void };
  state: {
    get<T = unknown>(key: string): T;
    set<T = unknown>(key: string, value: T): Promise<unknown>;
    on(key: string, handler: () => void): void;
  };
  on(event: string, handler: () => void): void;
  emit(event: string, payload: Record<string, unknown>): Promise<unknown> | void;
  onEvent(event: string, handler: () => void): void;
  updatePresence(value: Record<string, unknown>): Promise<unknown> | void;
}

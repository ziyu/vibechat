export interface AgentExecutionTarget {
  spaceInstanceId: string;
  agentId: string;
}

export type AgentRuntimeEvent =
  | {
      sessionId: string;
      type: "agent_message_chunk";
      content: { type: string; text?: string };
    }
  | { sessionId: string; type: "agent_thought_chunk" }
  | {
      sessionId: string;
      type: "tool_call";
      toolCallId: string;
      title?: string;
      status?: unknown;
      locations?: Array<{ path?: string }>;
      rawInput?: unknown;
    }
  | {
      sessionId: string;
      type: "tool_call_update";
      toolCallId: string;
      status?: unknown;
    };

export interface AgentRuntimeSubscription {
  dispose(): Promise<void>;
}

export interface AgentExecutionHandle {
  makeDirectory(path: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  listSessions(): Promise<Array<{ sessionId: string; status: string }>>;
  deleteSession(sessionId: string): Promise<void>;
  openSession(input: {
    sessionId: string;
    agent: string;
    cwd: string;
    env: Record<string, string>;
    permissionPolicy: "allow_all";
    additionalInstructions: string;
  }): Promise<void>;
  connect(
    onEvent: (event: AgentRuntimeEvent) => void,
  ): Promise<AgentRuntimeSubscription>;
  prompt(input: {
    sessionId: string;
    text: string;
  }): Promise<{ content: unknown }>;
}

export interface AgentExecutionRuntime {
  open(target: AgentExecutionTarget): AgentExecutionHandle;
}

export type AgentExecutionHandleFactory = (
  actorKey: string,
) => AgentExecutionHandle;

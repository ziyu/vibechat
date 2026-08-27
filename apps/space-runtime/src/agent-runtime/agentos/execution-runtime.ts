import { createClient } from "@rivet-dev/agentos/client";
import type { registry } from "../../actors.js";
import type {
  AgentExecutionHandle,
  AgentExecutionHandleFactory,
  AgentExecutionRuntime,
  AgentExecutionTarget,
  AgentRuntimeEvent,
} from "../contract.js";
import { agentExecutionActorKey } from "./actor-key.js";

const client = createClient<typeof registry>({
  endpoint:
    process.env.RIVET_ENDPOINT ??
    process.env.AGENTOS_ENDPOINT ??
    "http://127.0.0.1:6420",
});

type AgentOsExecutionVm = ReturnType<typeof client.vm.getOrCreate>;

class AgentOsExecutionHandle implements AgentExecutionHandle {
  readonly #vm: AgentOsExecutionVm;

  constructor(vm: AgentOsExecutionVm) {
    this.#vm = vm;
  }

  makeDirectory(path: string) {
    return this.#vm.filesystem.mkdir(path, { recursive: true });
  }

  writeFile(path: string, content: string) {
    return this.#vm.filesystem.writeFile(path, content);
  }

  readFile(path: string) {
    return this.#vm.filesystem.readFile(path);
  }

  async listSessions() {
    const page = await this.#vm.sessions.list({ limit: 100 });
    return page.sessions.map((session) => ({
      sessionId: session.sessionId,
      status: session.state.status,
    }));
  }

  async deleteSession(sessionId: string) {
    await this.#vm.sessions.delete({ sessionId });
  }

  async openSession(input: {
    sessionId: string;
    agent: string;
    cwd: string;
    env: Record<string, string>;
    permissionPolicy: "allow_all";
    additionalInstructions: string;
  }) {
    await this.#vm.sessions.open(input);
  }

  async connect(onEvent: (event: AgentRuntimeEvent) => void) {
    const connection = this.#vm.connect();
    await connection.ready;
    const unsubscribe = connection.on("sessionEvent", (event) => {
      if (
        event.type === "agent_message_chunk" ||
        event.type === "agent_thought_chunk" ||
        event.type === "tool_call" ||
        event.type === "tool_call_update"
      ) {
        onEvent(event as unknown as AgentRuntimeEvent);
      }
    });
    return {
      async dispose() {
        unsubscribe();
        await connection.dispose();
      },
    };
  }

  async prompt(input: { sessionId: string; text: string }) {
    const result = await this.#vm.sessions.prompt({
      sessionId: input.sessionId,
      content: [{ type: "text", text: input.text }],
    });
    return { content: result.message?.content };
  }
}

const createAgentOsHandle: AgentExecutionHandleFactory = (actorKey) =>
  new AgentOsExecutionHandle(client.vm.getOrCreate(actorKey));

export class AgentOsAgentExecutionRuntime implements AgentExecutionRuntime {
  readonly #createHandle: AgentExecutionHandleFactory;

  constructor(createHandle: AgentExecutionHandleFactory = createAgentOsHandle) {
    this.#createHandle = createHandle;
  }

  open(target: AgentExecutionTarget) {
    return this.#createHandle(agentExecutionActorKey(target));
  }
}

const bridgeVersion = 1;
const commandTimeoutMs = 15_000;
const presenceIntervalMs = 100;
const listeners = new Map();
const pendingCommands = new Map();

let currentSnapshot = emptySnapshot();
let readyResolved = false;
let resolveReady;
let lastPresenceSentAt = 0;
let pendingPresenceValue;
let pendingPresenceTimer;
let pendingPresenceWaiters = [];

const ready = new Promise((resolve) => {
  resolveReady = resolve;
});

function emptySnapshot() {
  return {
    appId: "",
    locale: "en",
    meta: { id: "", name: "Space", summary: "", icon: "V", accent: "#ff5a3d" },
    self: null,
    members: [],
    mentions: [],
    messages: [],
    app: { revision: 0, state: {}, presence: [] },
    chat: { messages: [], typingMemberIds: [] },
    agent: { id: "pi", name: "Pi", messages: [], build: null, queue: { activeCount: 0, pendingCount: 0 } },
  };
}

function clone(value) {
  if (value === undefined) return undefined;
  if (globalThis.structuredClone) return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeMember(member) {
  if (!member || typeof member !== "object") return null;
  const clientId = String(member.clientId || member.id || "");
  return { ...clone(member), id: clientId, clientId };
}

function normalizeMembers(members) {
  return (Array.isArray(members) ? members : [])
    .map(normalizeMember)
    .filter(Boolean);
}

function presenceRecord(entries = currentSnapshot.app.presence) {
  const result = {};
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || typeof entry !== "object") continue;
    const clientId = String(entry.clientId || entry.id || "");
    if (!clientId) continue;
    const value =
      entry.value && typeof entry.value === "object" && !Array.isArray(entry.value)
        ? entry.value
        : {};
    result[clientId] = {
      ...clone(value),
      id: clientId,
      clientId,
      name: entry.name || "",
      updatedAt: entry.updatedAt,
    };
  }
  return result;
}

function post(message) {
  if (window.parent === window) return;
  window.parent.postMessage(message, "*");
}

function command(action, payload = {}) {
  const id = globalThis.crypto?.randomUUID?.() ||
    `space-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`Space command timed out: ${action}`));
    }, commandTimeoutMs);
    pendingCommands.set(id, { resolve, reject, timeout });
    post({ type: "space:command", version: bridgeVersion, id, action, payload });
  });
}

function subscribe(type, handler) {
  if (typeof handler !== "function") {
    throw new TypeError("space.on requires a function");
  }
  const handlers = listeners.get(type) || new Set();
  handlers.add(handler);
  listeners.set(type, handlers);
  return () => {
    handlers.delete(handler);
    if (!handlers.size) listeners.delete(type);
  };
}

function dispatch(type, value) {
  for (const handler of listeners.get(type) || []) {
    try {
      handler(clone(value));
    } catch (error) {
      queueMicrotask(() => {
        throw error;
      });
    }
  }
}

function acceptSnapshot(snapshot) {
  currentSnapshot = {
    ...emptySnapshot(),
    ...clone(snapshot),
    app: {
      ...emptySnapshot().app,
      ...clone(snapshot?.app),
    },
    chat: {
      ...emptySnapshot().chat,
      ...clone(snapshot?.chat),
    },
    agent: {
      ...emptySnapshot().agent,
      ...clone(snapshot?.agent),
    },
  };
  currentSnapshot.self = normalizeMember(currentSnapshot.self);
  currentSnapshot.members = normalizeMembers(currentSnapshot.members);
  currentSnapshot.messages = clone(currentSnapshot.chat.messages || []);
  if (!readyResolved) {
    readyResolved = true;
    resolveReady(space);
  }
  dispatch("snapshot", currentSnapshot);
  dispatch("members", currentSnapshot.members);
  dispatch("messages", currentSnapshot.messages);
  dispatch("typing", currentSnapshot.chat.typingMemberIds);
  dispatch("mentions", currentSnapshot.mentions);
  dispatch("presence", presenceRecord());
  dispatch("state", stateUpdate());
  dispatch("agent", currentSnapshot.agent);
}

function acceptEvent(event) {
  if (!event || typeof event.type !== "string") return;
  if (event.type === "presence") {
    currentSnapshot.members = normalizeMembers(event.members);
    if (Array.isArray(event.appPresence)) {
      currentSnapshot.app.presence = clone(event.appPresence);
    }
    dispatch("members", currentSnapshot.members);
    dispatch("presence", presenceRecord());
  } else if (event.type === "app_state") {
    currentSnapshot.app.revision = Number(event.revision) || 0;
    if (event.deleted) delete currentSnapshot.app.state[event.key];
    else currentSnapshot.app.state[event.key] = clone(event.value);
    dispatch("state", stateUpdate(event));
  } else if (event.type === "app_presence" && event.presence) {
    const index = currentSnapshot.app.presence.findIndex(
      (presence) => presence.clientId === event.presence.clientId,
    );
    if (index >= 0) currentSnapshot.app.presence[index] = clone(event.presence);
    else currentSnapshot.app.presence.push(clone(event.presence));
    dispatch("presence", presenceRecord());
  } else if (event.type === "queue_updated") {
    currentSnapshot.agent.queue = {
      activeCount: Number(event.activeCount) || 0,
      pendingCount: Number(event.pendingCount) || 0,
    };
    dispatch("agent", currentSnapshot.agent);
  } else if (event.type === "turn_started") {
    currentSnapshot.agent.build = clone(event.turn || null);
    dispatch("agent", currentSnapshot.agent);
  } else if (
    event.type === "draft_ready" ||
    event.type === "deployed" ||
    event.type === "chat_completed" ||
    event.type === "turn_failed"
  ) {
    currentSnapshot.agent.build = null;
    dispatch("agent", currentSnapshot.agent);
  }

  if (event.type !== "presence") dispatch(event.type, event);
  if (event.type === "app_event") {
    dispatch("event", event);
    dispatch(`event:${event.name}`, event);
  }
}

function stateUpdate(event = {}) {
  return {
    revision: currentSnapshot.app.revision,
    values: clone(currentSnapshot.app.state),
    ...clone(event),
  };
}

function schedulePresence(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Promise.reject(new TypeError("space.updatePresence requires an object"));
  }
  pendingPresenceValue = clone(value);
  const result = new Promise((resolve, reject) => {
    pendingPresenceWaiters.push({ resolve, reject });
  });
  if (!pendingPresenceTimer) {
    const delay = Math.max(
      0,
      presenceIntervalMs - (Date.now() - lastPresenceSentAt),
    );
    pendingPresenceTimer = setTimeout(flushPresence, delay);
  }
  return result;
}

async function flushPresence() {
  pendingPresenceTimer = undefined;
  const value = pendingPresenceValue;
  const waiters = pendingPresenceWaiters;
  pendingPresenceValue = undefined;
  pendingPresenceWaiters = [];
  lastPresenceSentAt = Date.now();
  try {
    const result = await command("presence.update", { value });
    for (const waiter of waiters) waiter.resolve(result);
  } catch (error) {
    for (const waiter of waiters) waiter.reject(error);
  }
  if (pendingPresenceValue !== undefined && !pendingPresenceTimer) {
    pendingPresenceTimer = setTimeout(flushPresence, presenceIntervalMs);
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || !event.data) return;
  if (event.data.type === "space:init" && event.data.version === bridgeVersion) {
    acceptSnapshot(event.data.snapshot);
    return;
  }
  if (event.data.type === "space:event" && event.data.version === bridgeVersion) {
    acceptEvent(event.data.event);
    return;
  }
  if (event.data.type !== "space:result") return;
  const pending = pendingCommands.get(event.data.id);
  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingCommands.delete(event.data.id);
  if (event.data.ok) pending.resolve(clone(event.data.result));
  else pending.reject(new Error(event.data.error || "Space command failed"));
});

export const space = Object.freeze({
  version: bridgeVersion,
  ready,
  get appId() {
    return currentSnapshot.appId;
  },
  get locale() {
    return currentSnapshot.locale;
  },
  get meta() {
    return clone(currentSnapshot.meta);
  },
  get self() {
    return clone(currentSnapshot.self);
  },
  get members() {
    return clone(currentSnapshot.members);
  },
  get messages() {
    return clone(currentSnapshot.messages);
  },
  get mentions() {
    return clone(currentSnapshot.mentions);
  },
  get presence() {
    return presenceRecord();
  },
  get presenceList() {
    return clone(currentSnapshot.app.presence);
  },
  get agent() {
    return clone(currentSnapshot.agent);
  },
  get snapshot() {
    return clone(currentSnapshot);
  },
  on: subscribe,
  onEvent(name, handler) {
    return subscribe(`event:${name}`, handler);
  },
  updatePresence: schedulePresence,
  emit(name, payload = null) {
    return command("event.emit", { name, payload });
  },
  state: Object.freeze({
    get(key) {
      return key === undefined
        ? clone(currentSnapshot.app.state)
        : clone(currentSnapshot.app.state[key]);
    },
    snapshot() {
      return stateUpdate();
    },
    set(key, value) {
      return command("state.set", { key, value });
    },
    delete(key) {
      return command("state.delete", { key });
    },
    on(keyOrHandler, handler) {
      if (typeof keyOrHandler === "function") {
        return subscribe("state", keyOrHandler);
      }
      if (typeof keyOrHandler === "string" && typeof handler === "function") {
        return subscribe("state", (update) => {
          if (!update.key || update.key === keyOrHandler) {
            handler(clone(update.values[keyOrHandler]), update);
          }
        });
      }
      throw new TypeError("space.state.on requires a handler or key and handler");
    },
  }),
  chat: Object.freeze({
    get messages() {
      return clone(currentSnapshot.chat.messages);
    },
    get typingMemberIds() {
      return clone(currentSnapshot.chat.typingMemberIds);
    },
    send(input) {
      return command(
        "chat.send",
        typeof input === "string" ? { text: input } : input,
      );
    },
    attach(file) {
      return command("chat.attach", { file });
    },
    edit(messageId, text) {
      return command("chat.edit", { messageId, text });
    },
    delete(messageId) {
      return command("chat.delete", { messageId });
    },
    toggleReaction(messageId, emoji) {
      return command("chat.reaction.toggle", { messageId, emoji });
    },
    retry(messageId) {
      return command("chat.retry", { messageId });
    },
    setTyping(isTyping) {
      return command("chat.typing", { isTyping });
    },
    markRead() {
      return command("chat.markRead");
    },
    on(handler) {
      return subscribe("messages", handler);
    },
  }),
  mention: Object.freeze({
    search(query = "") {
      const normalized = String(query).trim().toLowerCase();
      return clone(currentSnapshot.mentions).filter((target) =>
        !normalized || `${target.name} ${target.handle}`.toLowerCase().includes(normalized)
      );
    },
    on(handler) {
      return subscribe("mentions", handler);
    },
  }),
  theme: Object.freeze({
    set(theme) {
      post({ type: "space:theme", theme });
    },
  }),
});

globalThis.spaceApp = space;
post({ type: "space:bridge-ready", version: bridgeVersion });

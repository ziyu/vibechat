# Tomorrow Postcard

## 0.1.3

- Replace the Template-owned Chat renderer, Composer, Mention, message actions, and state machine with exact `@vibechat/space-app-components@0.7.4` package imports.
- Preserve postcard writing, shared card state, presence, warm paper theme, dock launcher, unread behavior, and responsive drawer layout.
- Add the managed package integrity lock and declare the complete Chat capability set used by the shared controller.

## 0.1.2

- Refactor the App and default Chat UI into type-checked, responsibility-focused modules.
- Keep the full Space identity in the Kernel Bar, move attachment controls into the Composer, and fix its responsive layout without changing Chat Core capabilities.
- Describe Agent work neutrally because a turn may answer in Chat without changing the Space App.
- Resolve Agent message authors from logical Mention targets instead of exposing managed Matrix users as members.

## 0.1.1

- Export the AgentOS application registry from the Project entrypoint so immutable Release replicas can start correctly.

## 0.1.0

- Establish the first ordered pre-1.0 Template publication baseline.
- Preserve the existing ready App Project and immutable Chat Core capabilities.

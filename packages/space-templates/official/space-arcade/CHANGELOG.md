# Pixel Saturday

## 0.1.3

- Pin `@vibechat/space-app-components@0.7.4` through the managed dependency lock and replace the duplicated drawer Chat renderer, Composer, Mention, message actions, and state machine with the shared Chat controller and elements.
- Preserve the Pixel Saturday badge collection, shared signal, presence, theme, drawer transform, backdrop blur, and responsive layout while adding canonical unread, visible-only read receipts, compact actions, and structured Mention behavior.

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

# Vibe Chat

## 0.1.6

- Upgrade to `@vibechat/space-app-components@0.7.4` so compact message actions use the browser Popover top layer while retaining the fixed-position fallback, full-width mobile action sheet, and deterministic light-dismiss focus restoration.

## 0.1.5

- Upgrade to `@vibechat/space-app-components@0.7.0` and replace the always-visible action grid with one canonical Reaction row plus progressively disclosed message actions.
- Group adjacent messages from the same author, anchor controls to the bubble width, and suppress repeated author, time, delivery, and avatar chrome.
- Present message actions as an accessible desktop menu and mobile action sheet with keyboard focus handling, localized copy, dangerous delete confirmation, and authored SVG iconography.
- Focus the Composer after Reply or Edit so the selected action immediately continues into its expected task.

## 0.1.4

- Consume `@vibechat/space-app-components@0.6.0` with Host-authorized message actions and Timeline-owned interaction composition.
- Remove all Template access to component Shadow DOM and style only documented Timeline parts.
- Keep Matrix read receipts current while the Chat surface is open and visible, with deduplicated non-blocking commands and accumulating dock unread state.
- Use public component types in the adapter and localize the document, Chat region, launch, close, and timeline accessible names.

## 0.1.3

- Depend on the publishable framework-neutral Space Chat package through the semantic `@vibechat/space-app-components/chat/inline` subpath, exact `0.5.0` version and managed Registry integrity pin.
- Keep generated dependency files out of Template source; Runtime materializes the verified package only in Candidate/Revision build artifacts.
- Replace the Template-owned message state machine, Composer, Mention menu, message projection, actions, reactions, attachments, and error UI with a thin adapter over the injected Space SDK.
- Preserve the full-screen dark visual composition while keeping Matrix timeline order as the only message source and sending Agent requests only through structured Mention Chat events.

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

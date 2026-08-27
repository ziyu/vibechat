# Vibe Chat

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

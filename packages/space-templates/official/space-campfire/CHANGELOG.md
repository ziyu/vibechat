# Afterglow Radio

## 0.1.7

- Upgrade Chat and User identity consumption to exact `@vibechat/space-app-components@0.11.1`; message authors now reuse the same UserInfoCard/AgentCard contract as the shared member directory.

## 0.1.6

- Replace the hand-written member pills with the shared User Directory controller and MemberList from exact `@vibechat/space-app-components@0.10.2`, while preserving the radio scene, presence update, and docked Chat.

## 0.1.5

- Upgrade to `@vibechat/space-app-components@0.7.4` and restore the drawer's original transform and backdrop-filter; shared action menus now remain independent through the browser Popover top layer.

## 0.1.4

- Keep the drawer's backdrop blur on a non-ancestor decoration layer so viewport-positioned shared action menus remain visible and interactive.

## 0.1.3

- Replace the duplicated drawer Chat projection, Composer, Mention, message actions, and error handling with exact `@vibechat/space-app-components@0.7.0` package imports.
- Preserve the Afterglow Radio surface, presence interaction, theme, and dock launcher while adding shared unread, read-receipt, compact actions, and narrow-screen behavior.
- Remove the open drawer's transformed containing block so viewport-positioned shared action menus remain visible and interactive.

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

import { escapeHtml } from "../browser/html.js";
import { renderModuleScript } from "../browser/module-script.js";
import { bootstrapChat } from "./client/bootstrap.js";
import {
  attachSelectedFile,
  chooseMention,
  clearChatContext,
  handleTimelineAction,
  setChatError,
  showChatContext,
  submitChatMessage,
  updateComposerMentions,
} from "./client/composer.js";
import { getChatCopy } from "./client/copy.js";
import {
  closestDataTarget,
  formatMessageTime,
  getChatElements,
  requireElement,
  resizeComposer,
} from "./client/dom.js";
import { findMember, getAllMessages, renderMessageHtml } from "./client/messages.js";
import { createChatState, renderChat } from "./client/render.js";

export const chatClient = renderModuleScript({
  attributes: ["data-vibechat-default-chat-app"],
  imports: ['import { space } from "/v1/space-app-sdk";'],
  functions: [
    escapeHtml,
    getChatCopy,
    requireElement,
    getChatElements,
    formatMessageTime,
    closestDataTarget,
    resizeComposer,
    findMember,
    getAllMessages,
    renderMessageHtml,
    createChatState,
    renderChat,
    setChatError,
    showChatContext,
    clearChatContext,
    handleTimelineAction,
    submitChatMessage,
    updateComposerMentions,
    chooseMention,
    attachSelectedFile,
    bootstrapChat,
  ],
  bootstrap: 'await bootstrapChat(space, "full");',
});

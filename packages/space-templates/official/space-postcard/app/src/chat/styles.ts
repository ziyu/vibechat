import { chatComposerStyles } from "./styles/composer.js";
import { chatFoundationStyles } from "./styles/foundation.js";
import { chatResponsiveStyles } from "./styles/responsive.js";
import { chatTimelineStyles } from "./styles/timeline.js";

export const chatStyles = `<style data-vibechat-default-chat data-vibechat-chat-contract="3">
${chatFoundationStyles}
${chatTimelineStyles}
${chatComposerStyles}
${chatResponsiveStyles}
</style>`;

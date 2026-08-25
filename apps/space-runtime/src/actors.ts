import pi from "@agentos-software/pi";
import { agentOS, setup } from "@rivet-dev/agentos";
import { setupApps } from "@rivet-dev/agentos-apps";

const { appsActors } = setupApps();
const vm = agentOS({ software: [pi] });

export const registry = setup({
  use: {
    vm,
    ...appsActors,
  },
});

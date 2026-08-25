import { actor, setup } from "rivetkit";

const templateRuntime = actor({
  state: { boots: 0 },
  actions: {
    boot(context) {
      context.state.boots += 1;
      return context.state.boots;
    },
  },
});

export const registry = setup({ use: { templateRuntime } });

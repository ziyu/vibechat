import { actor, setup } from "rivetkit";

const pageVisits = actor({
  state: { count: 0 },
  actions: {
    visit(context) {
      context.state.count += 1;
      return context.state.count;
    },
  },
});

export const registry = setup({ use: { pageVisits } });

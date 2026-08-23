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
registry.start();

export default function fetch() {
  return new Response(
    `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Untitled space</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; overflow: hidden; background: #10140f; color: #f2f0e6; font: 16px/1.6 Georgia, serif; }
          main { width: min(720px, calc(100% - 48px)); text-align: center; }
          h1 { margin: 0; font-size: clamp(52px, 10vw, 128px); font-weight: 400; line-height: .86; letter-spacing: -.055em; }
          p { margin: 24px auto 0; max-width: 480px; color: #9da494; }
          .glow { position: fixed; width: 60vw; aspect-ratio: 1; border-radius: 50%; background: #d8ff58; filter: blur(150px); opacity: .09; pointer-events: none; }
        </style>
      </head>
      <body>
        <div class="glow"></div>
        <main><h1>Space<br />without walls.</h1><p id="space-copy">Joining the people here…</p></main>
        <script type="module">
          import { space } from "/v1/space-app-sdk";

          space.theme.set({
              text: "#f2f0e6",
              muted: "rgba(242,240,230,.58)",
              accent: "#d8ff58",
              surface: "rgba(10,13,9,.48)",
              surfaceStrong: "rgba(10,13,9,.82)",
              border: "rgba(242,240,230,.18)",
              own: "#9bd0ff",
              peer: "#ff9a78",
              agent: "#d8ff58",
              radius: "16px"
          });

          const copy = document.querySelector("#space-copy");
          const renderMembers = () => {
            const count = space.members.length;
            copy.textContent = count + (count === 1
              ? " person is shaping this space. Ask Pi to give it a new form."
              : " people are shaping this space. Ask Pi to give it a new form.");
          };
          await space.ready;
          renderMembers();
          space.on("members", renderMembers);
        </script>
      </body>
    </html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const appStyles = `<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; overflow: hidden; background: #10140f; color: #f2f0e6; font: 16px/1.6 Georgia, serif; }
  main { width: min(720px, calc(100% - 48px)); text-align: center; }
  h1 { margin: 0; font-size: clamp(52px, 10vw, 128px); font-weight: 400; line-height: .86; letter-spacing: -.055em; }
  p { margin: 24px auto 0; max-width: 480px; color: #9da494; }
  .glow { position: fixed; width: 60vw; aspect-ratio: 1; border-radius: 50%; background: #d8ff58; filter: blur(150px); opacity: .09; pointer-events: none; }
</style>`;

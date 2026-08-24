export const appStyles = `<style>
* { box-sizing: border-box; }

body {
  min-height: 100vh;
  margin: 0;
  background: radial-gradient(circle at 70% 20%, #3c291f 0, transparent 38%), #171b20;
  color: #f8eee4;
  font: 15px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
}

.shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 1fr minmax(280px, 420px);
  gap: 40px;
  padding: clamp(28px, 6vw, 72px);
}

.eyebrow {
  color: #ff8a66;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.dial {
  position: relative;
  display: grid;
  width: min(42vw, 420px);
  aspect-ratio: 1;
  place-items: center;
  border: 1px solid #765447;
  border-radius: 50%;
  box-shadow: inset 0 0 80px #0008, 0 0 80px #ff6b4218;
}

.dial::after {
  position: absolute;
  inset: 12%;
  border: 1px dashed #9e7565;
  border-radius: 50%;
  content: "";
}

.frequency {
  font: 400 clamp(56px, 9vw, 118px) / 1 Georgia, serif;
  letter-spacing: -0.08em;
}

.panel {
  align-self: end;
  padding-top: 24px;
  border-top: 1px solid #61483e;
}

h1 {
  margin: 14px 0;
  font: 400 clamp(42px, 6vw, 76px) / 0.95 Georgia, serif;
}

p { color: #c7b6aa; }
.members { display: flex; flex-wrap: wrap; gap: 8px; }

.member {
  padding: 7px 12px;
  border: 1px solid #694d42;
  border-radius: 999px;
  color: #f5d8c8;
}

.live {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 8px;
  border-radius: 50%;
  background: #ff6b42;
  box-shadow: 0 0 12px #ff6b42;
}

@media (max-width: 720px) {
  .shell { grid-template-columns: 1fr; }
  .dial { width: min(76vw, 360px); }
}
</style>
`;

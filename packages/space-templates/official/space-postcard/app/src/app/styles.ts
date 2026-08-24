export const appStyles = `<style>
* { box-sizing: border-box; }

body {
  min-height: 100vh;
  margin: 0;
  background: #efe5d2;
  color: #352923;
  font: 16px/1.55 Georgia, serif;
}

.world {
  min-height: 100vh;
  padding: clamp(24px, 6vw, 72px);
  background: linear-gradient(120deg, #e3d4b9 0 1px, transparent 1px) 0 0 / 34px 34px;
}

.mast {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 20px;
}

.kicker {
  color: #a44038;
  font: 12px ui-monospace, monospace;
  letter-spacing: 0.15em;
}

h1 {
  margin: 14px 0 42px;
  font: 400 clamp(52px, 9vw, 112px) / 0.82 Georgia, serif;
  letter-spacing: -0.07em;
}

.postcards {
  display: flex;
  gap: 22px;
  overflow: auto;
  padding: 8px 8px 26px;
}

.card {
  position: relative;
  flex: 0 0 min(370px, 82vw);
  min-height: 230px;
  padding: 28px;
  border: 1px solid #ccab8d;
  background: #faf2e3;
  box-shadow: 8px 10px 0 #9a76573d;
}

.stamp {
  position: absolute;
  top: 20px;
  right: 22px;
  padding: 10px;
  border: 2px dotted #d84b42;
  color: #d84b42;
  font: 11px ui-monospace, monospace;
}

.card p {
  margin: 44px 0 20px;
  font-size: 24px;
}

.composer {
  display: grid;
  max-width: 760px;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  margin-top: 24px;
}

textarea {
  min-height: 92px;
  padding: 16px;
  resize: vertical;
  border: 1px solid #b69275;
  background: #fffaf0;
  font: 16px Georgia, serif;
}

button {
  padding: 0 22px;
  border: 0;
  background: #d84b42;
  color: white;
  font-weight: 700;
  cursor: pointer;
}
</style>
`;

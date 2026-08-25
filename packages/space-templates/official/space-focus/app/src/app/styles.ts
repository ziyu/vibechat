export const appStyles = `<style>
* { box-sizing: border-box; }

body {
  min-height: 100vh;
  margin: 0;
  background: #23342b;
  color: #eef5df;
  font: 16px/1.5 Inter, system-ui, sans-serif;
}

.desk {
  min-height: 100vh;
  padding: clamp(24px, 5vw, 64px);
  background-image:
    linear-gradient(#b7d66d0c 1px, transparent 1px),
    linear-gradient(90deg, #b7d66d0c 1px, transparent 1px);
  background-size: 32px 32px;
}

.top {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #6e865b;
}

.label {
  color: #b7d66d;
  font: 12px ui-monospace, monospace;
  letter-spacing: 0.16em;
}

h1 {
  margin: 10px 0 0;
  font: 400 clamp(42px, 7vw, 84px) / 0.95 Georgia, serif;
}

.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 18px;
  margin-top: 32px;
}

.note {
  min-height: 160px;
  padding: 20px;
  transform: rotate(var(--r));
  background: #e8e3b9;
  color: #263229;
  box-shadow: 5px 8px 0 #1118;
  white-space: pre-wrap;
}

.composer {
  display: flex;
  gap: 10px;
  margin-top: 28px;
}

input {
  min-width: 0;
  flex: 1;
  padding: 14px;
  border: 1px solid #718d61;
  border-radius: 10px;
  background: #19271f;
  color: #fff;
}

button {
  padding: 0 20px;
  border: 0;
  border-radius: 10px;
  background: #b7d66d;
  color: #1c281f;
  font-weight: 700;
  cursor: pointer;
}
</style>
`;

export const appStyles = `<style>
* { box-sizing: border-box; }

body {
  min-height: 100vh;
  margin: 0;
  background: #211832;
  color: #fff5bf;
  font: 16px/1.4 ui-monospace, SFMono-Regular, monospace;
  image-rendering: pixelated;
}

.frame {
  display: grid;
  min-height: 100vh;
  padding: clamp(22px, 5vw, 60px);
  place-items: center;
  background: radial-gradient(circle at 50% 20%, #604a8b 0, transparent 48%);
}

.console {
  width: min(780px, 100%);
  padding: clamp(24px, 5vw, 48px);
  border: 5px solid #171020;
  border-radius: 28px;
  outline: 3px solid #ffd84d;
  background: #34274f;
  box-shadow: 18px 20px 0 #0f0a18;
}

.score {
  display: flex;
  justify-content: space-between;
  color: #ffd84d;
  font-size: 13px;
}

.screen {
  min-height: 260px;
  margin: 24px 0;
  padding: 30px;
  border: 4px solid #171020;
  background: #a8c96b;
  color: #20301d;
  box-shadow: inset 0 0 0 5px #708c4f;
}

.pixel {
  text-align: center;
  font-size: clamp(56px, 12vw, 110px);
  filter: drop-shadow(6px 6px 0 #52693b);
}

h1 {
  margin: 4px 0;
  text-align: center;
  letter-spacing: -0.08em;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 18px;
}

button {
  width: 72px;
  aspect-ratio: 1;
  border: 4px solid #171020;
  border-radius: 50%;
  background: #ff6b72;
  color: #fff;
  box-shadow: 0 6px 0 #8f313d;
  font-weight: 900;
  cursor: pointer;
}

button:active {
  transform: translateY(5px);
  box-shadow: 0 1px 0 #8f313d;
}
</style>
`;

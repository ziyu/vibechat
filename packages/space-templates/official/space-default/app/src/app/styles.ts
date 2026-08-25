export const appStyles = `<style>
* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
  margin: 0;
  background: #10120f;
  color: #f6f1e8;
}

body::before {
  position: fixed;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 0 49.9%,
    rgba(255, 255, 255, 0.025) 50%,
    transparent 50.1%
  ) 0 0 / 56px 56px;
  content: "";
  pointer-events: none;
}
</style>
`;

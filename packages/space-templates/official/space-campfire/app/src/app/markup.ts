export const appMarkup = `
<main class="shell">
  <section>
    <div class="eyebrow"><span class="live"></span>on air · afterglow</div>
    <div class="dial"><div class="frequency">88.7</div></div>
  </section>
  <section class="panel">
    <div class="eyebrow">VibeChat Space Template</div>
    <h1>夜航电台</h1>
    <p id="copy">正在调入这个 Space 的成员频率…</p>
    <vc-space-member-list
      id="members"
      class="members"
      density="compact"
      locale="zh-CN"
    ></vc-space-member-list>
  </section>
</main>`;

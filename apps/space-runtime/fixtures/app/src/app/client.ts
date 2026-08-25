export const appClient = `<script type="module">
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
</script>`;

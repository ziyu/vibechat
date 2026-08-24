export const appClient = `<script type="module">
import { space } from "/v1/space-app-sdk";
space.theme.set({text:"#fff5bf",muted:"#d6ca95",accent:"#ffd84d",surface:"#34274f",surfaceStrong:"#211832",border:"#ffd84d",own:"#ff7791",peer:"#82d9bf",agent:"#ffd84d",radius:"8px"});
const pixel=document.querySelector("#pixel"),players=document.querySelector("#players"),copy=document.querySelector("#copy");function count(){return Number(space.state.get("arcade.badges"))||0}function render(){const value=count();pixel.textContent=["✦","◆","★","✸"][value%4];copy.textContent="这个 Space 已共同收集 "+value+" 枚徽章。";players.textContent="PLAYERS "+space.members.length}
await space.ready;render();space.state.on("arcade.badges",render);space.on("members",render);document.querySelector("#collect").onclick=()=>space.state.set("arcade.badges",count()+1);document.querySelector("#signal").onclick=()=>space.emit("arcade.signal",{from:space.self?.name});space.onEvent("arcade.signal",()=>{pixel.animate([{transform:"scale(1)"},{transform:"scale(1.35)"},{transform:"scale(1)"}],{duration:420})});space.updatePresence({scene:"arcade",status:"playing"});
</script>
`;

export const appClient = `<script type="module">
import { space } from "/v1/space-app-sdk";
space.theme.set({text:"#f8eee4",muted:"#c7b6aa",accent:"#ff6b42",surface:"#171b20",surfaceStrong:"#111419",border:"#61483e",own:"#ff9a78",peer:"#ffd0b5",agent:"#ff6b42",radius:"18px"});
const members=document.querySelector("#members"),copy=document.querySelector("#copy");
const safe=value=>String(value).replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
function render(){const list=space.members;copy.textContent=list.length+" 位听众正在共享今晚的频率。Chat 始终在线，@Agent 可以继续改造这间电台。";members.innerHTML=list.map(m=>'<span class="member">'+safe(m.name)+'</span>').join("")||'<span class="member">等待听众</span>'}
await space.ready;render();space.on("members",render);space.updatePresence({scene:"radio",status:"listening"});
</script>
`;

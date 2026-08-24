export const appClient = `<script type="module">
import { space } from "/v1/space-app-sdk";
space.theme.set({text:"#eef5df",muted:"#aab9a5",accent:"#b7d66d",surface:"#23342b",surfaceStrong:"#19271f",border:"#6e865b",own:"#d9ef9e",peer:"#93c4a7",agent:"#b7d66d",radius:"12px"});
const board=document.querySelector("#board"),presence=document.querySelector("#presence"),form=document.querySelector("#form"),input=document.querySelector("#note");
const safe=value=>String(value).replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
function notes(){const value=space.state.get("studio.notes");return Array.isArray(value)?value:[]}
function render(){const values=notes();board.innerHTML=values.map((n,i)=>'<article class="note" style="--r:'+(i%2?1.2:-1.1)+'deg">'+safe(n.text)+'<br><small>— '+safe(n.author)+'</small></article>').join("")||'<article class="note" style="--r:-1deg">第一张便签还空着。<br><small>这个 Project 已从模板独立复制。</small></article>';presence.textContent=space.members.length+" 位成员同桌"}
await space.ready;render();space.state.on("studio.notes",render);space.on("members",render);form.addEventListener("submit",async e=>{e.preventDefault();const text=input.value.trim();if(!text)return;await space.state.set("studio.notes",[...notes(),{text,author:space.self?.name||"成员",at:Date.now()}].slice(-12));input.value=""});space.updatePresence({scene:"studio",status:"writing"});
</script>
`;

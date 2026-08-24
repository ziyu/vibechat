export const appClient = `<script type="module">
import { space } from "/v1/space-app-sdk";
space.theme.set({text:"#352923",muted:"#826d61",accent:"#d84b42",surface:"#efe5d2",surfaceStrong:"#faf2e3",border:"#b69275",own:"#d84b42",peer:"#567e78",agent:"#b99732",radius:"4px"});
const cards=document.querySelector("#postcards"),count=document.querySelector("#count"),form=document.querySelector("#form"),message=document.querySelector("#message");function list(){const value=space.state.get("postcard.messages");return Array.isArray(value)?value:[]}
const safe=value=>String(value).replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
function render(){const values=list();count.textContent=values.length+" POSTCARDS";cards.innerHTML=values.map((item,i)=>'<article class="card"><span class="stamp">TOMORROW '+String(i+1).padStart(2,"0")+'</span><p>'+safe(item.text)+'</p><small>FROM '+safe(item.author)+'</small></article>').join("")||'<article class="card"><span class="stamp">READY</span><p>这里还没有信，但这个独立 Project 已准备好。</p><small>FROM VIBECHAT</small></article>'}
await space.ready;render();space.state.on("postcard.messages",render);form.addEventListener("submit",async e=>{e.preventDefault();const text=message.value.trim();if(!text)return;await space.state.set("postcard.messages",[...list(),{text,author:space.self?.name||"成员",at:Date.now()}].slice(-10));message.value=""});space.updatePresence({scene:"postcard",status:"writing"});
</script>
`;

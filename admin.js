const $ = id => document.getElementById(id);
async function api(url, options={}) {
 const r=await fetch(url,{headers:{"Content-Type":"application/json"},...options});
 const d=await r.json().catch(()=>({error:"Serwer jogap bermedi."}));
 if(!r.ok) throw new Error(d.error||"Ýalňyşlyk"); return d;
}
function showDashboard(){ $("adminLogin").classList.add("hidden"); $("dashboard").classList.remove("hidden"); refresh(); }
async function refresh(){
 try{
  const d=await api("/api/admin/stats");
  const labels=[["Kartlaryň jemi",d.stats.totalCards],["Saýlanan kart",d.stats.pickedCards],["Galan kart",d.stats.remainingCards],["Döredilen kod",d.stats.totalCodes],["Ulanylan kod",d.stats.usedCodes],["Ulanylmadyk kod",d.stats.unusedCodes]];
  $("stats").innerHTML=labels.map(x=>`<div class="stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
  $("wins").innerHTML=d.wins.length?d.wins.map(w=>`<div class="win"><strong>${w.prize_title}</strong><small>${new Date(w.picked_at).toLocaleString()}</small></div>`).join(""):"Entäk baýrak çykmady.";
 }catch(e){$("adminMsg").textContent=e.message;}
}
$("adminForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/admin/login",{method:"POST",body:JSON.stringify({password:$("adminPassword").value})});showDashboard();}catch(err){$("adminMsg").textContent=err.message;}});
$("createForm").addEventListener("submit",async e=>{e.preventDefault();try{const d=await api("/api/admin/codes",{method:"POST",body:JSON.stringify({count:Number($("codeCount").value)})});$("newCodes").innerHTML=d.codes.map(c=>`<div class="code-row"><code>${c}</code><button class="copy-btn" data-code="${c}">Göçür</button></div>`).join("");$("newCodes").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>navigator.clipboard.writeText(b.dataset.code).then(()=>b.textContent="Göçürildi ✓")));refresh();}catch(err){alert(err.message);}});
$("logout").addEventListener("click",async()=>{await api("/api/admin/logout",{method:"POST"});location.reload();});

const $ = id => document.getElementById(id);
const login = $("login"), game = $("game"), result = $("result");
async function api(url, options={}) {
  const r = await fetch(url, {headers: {"Content-Type":"application/json"}, ...options});
  const data = await r.json().catch(()=>({error:"Serwer jogap bermedi."}));
  if (!r.ok) throw new Error(data.error || "Ýalňyşlyk ýüze çykdy.");
  return data;
}
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
async function status() {
  try { const s = await api("/api/status"); $("remaining").textContent = s.remaining; } catch {}
}
async function loadGame() {
  const state = await api("/api/play");
  hide(login); hide(result);
  if (state.used) throw new Error("Bu giriş mümkinçiligi eýýäm ulanyldy.");
  const data = await api("/api/cards");
  $("remaining").textContent = data.cards.length;
  const grid = $("cards"); grid.innerHTML = "";
  data.cards.forEach(id => {
    const b = document.createElement("button");
    b.className = "card"; b.type = "button"; b.innerHTML = `<span class="card-corner">✦</span><span class="card-logo">L</span><span class="card-number">${String(id).padStart(3,"0")}</span><span class="card-corner bottom">✦</span>`;
    b.setAttribute("aria-label", `Kart ${id}`);
    b.addEventListener("click", () => pick(id, b));
    grid.appendChild(b);
  });
  show(game);
}
async function pick(id, button) {
  if (!confirm("Şu karty saýlaýarsyňmy? Bu mümkinçiligiň diňe bir gezek bar.")) return;
  document.querySelectorAll(".card").forEach(b => b.disabled = true);
  button.classList.add("flipped");
  try {
    const r = await api("/api/pick", {method:"POST", body:JSON.stringify({cardId:id})});
    hide(game); show(result);
    $("resultTitle").textContent = r.won ? "Gutlaýarys! 🎉" : "Bu gezek boş kart çykdy";
    $("resultText").textContent = r.won ? r.prize : "Indiki gezek şowlulyk seniň tarapyňda bolsun!";
    await status();
  } catch(e) {
    alert(e.message);
    document.querySelectorAll(".card").forEach(b => b.disabled = false);
    button.classList.remove("flipped");
    await status();
  }
}
$("codeForm").addEventListener("submit", async e => {
  e.preventDefault(); $("loginMsg").textContent = "";
  try {
    await api("/api/redeem", {method:"POST", body:JSON.stringify({code:$("entryCode").value})});
    await loadGame();
  } catch(err) { $("loginMsg").textContent = err.message; }
});
status();
api("/api/play").then(loadGame).catch(()=>{});

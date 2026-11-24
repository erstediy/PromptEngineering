const el = id => document.getElementById(id);
let token = sessionStorage.getItem("lighthouse"), game, busy = false;
async function api(path, body) {
  const response = await fetch(path, body ? {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)} : {});
  const data = await response.json();
  if (!response.ok) { if(data.game) render(data.game); throw Error(data.error || "Не удалось открыть партию"); }
  return data;
}
function render(s) {
  game=s; el("setup").hidden=true; el("table").hidden=false;
  el("place").textContent=s.place; el("subtitle").textContent="Судовой журнал · Ход " + s.turn;
  el("hp").textContent=Object.entries(s.hp).map(([n,h])=>n+"   "+h+"/3").join("\n");
  el("bag").textContent=s.bag.join("\n") || "Пусто";
  el("rolls").textContent=s.rolls.join("\n") || "Бросков пока нет";
  el("story").replaceChildren();
  for(const [who,line] of s.history){const b=document.createElement("b"),p=document.createElement("p");b.textContent=who;p.textContent=line;el("story").append(b,p);}
  el("story").scrollTop=el("story").scrollHeight;
  const active=el("hero").value; el("hero").replaceChildren();
  for(const [n,h] of Object.entries(s.hp)) if(h){el("hero").add(new Option(n,n,false,n===active));}
  el("ending").textContent=s.ending; el("move").hidden=Boolean(s.ending);
}
el("party").onsubmit=async event=>{
  event.preventDefault();if(busy)return;busy=true;
  try{let heroes=Array.from(document.querySelectorAll("input:checked"),x=>x.value);
    const data=await api("/games",{heroes});token=data.id;sessionStorage.setItem("lighthouse",token);render(data.game);el("status").textContent="";
  }catch(e){el("status").textContent=e.message;}finally{busy=false;}
};
el("move").onsubmit=async event=>{
  event.preventDefault(); if(busy)return;busy=true;
  el("send").disabled=true;el("action").readOnly=true;el("status").textContent="Мастер ведёт ход…";
  try{const data=await api("/games/"+token,{hero:el("hero").value,action:el("action").value,turn:game.turn});
    render(data.game);el("action").value="";el("status").textContent="";
  }catch(e){el("status").textContent=e.message;}finally{busy=false;el("send").disabled=false;el("action").readOnly=false;}
};
el("restart").onclick=()=>{if(!busy && (game.ending || confirm("Начать новую партию?"))){sessionStorage.removeItem("lighthouse");location.reload();}};
if(token)api("/games/"+token).then(d=>render(d.game)).catch(e=>{sessionStorage.removeItem("lighthouse");el("status").textContent=e.message;});

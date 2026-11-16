const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let activeView = "home", pairCode = null, tvSocket = null, controllerConnected = false;
let game = null, animationId = null, keys = new Set(), toastTimer;

function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2400)}
function setView(view){activeView=view;$$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));if(view==="library")renderLibrary();window.scrollTo({top:0,behavior:"smooth"});const first=$(`#view-${view} button`);first?.focus({preventScroll:true})}
$$(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$$("[data-goto]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.goto)));
$("#clock").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
setInterval(()=>$("#clock").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),30000);

const games=[
 {id:"neon",name:"Neon Breakout",sub:"Arcade · Browser game",status:"Playable",cover:"cover-neon",description:"A glowing arcade brick-breaker. Move the paddle, keep the ball alive and clear the board."},
 {id:"orbit",name:"Orbit Runner",sub:"Coming soon · Demo planned",status:"Coming soon",cover:"cover-orbit"},
 {id:"pixel",name:"Pixel Quest",sub:"Coming soon · Demo planned",status:"Coming soon",cover:"cover-pixel"},
 {id:"racer",name:"Night Racer",sub:"Coming soon · Demo planned",status:"Coming soon",cover:"cover-racer"}
];
function card(g){return `<button class="game-card" data-game="${g.id}"><div class="cover ${g.cover}"><span class="cover-label">${g.status==="Playable"?"PLAY NOW":"COMING SOON"}</span><strong>${g.name.toUpperCase().replace(" ","<br>")}</strong></div><span class="game-name">${g.name}</span><span class="game-sub">${g.sub}</span></button>`}
function renderLibrary(query=""){const list=games.filter(g=>g.name.toLowerCase().includes(query.toLowerCase()));$("#library-grid").innerHTML=list.length?list.map(card).join(""):`<div class="empty-state">No games match that search.</div>`;$("#library-count").textContent=`${list.filter(g=>g.status==="Playable").length} playable · ${list.length} shown`;bindGameCards()}
$("#store-grid").innerHTML=card(games[0]);renderLibrary();$("#game-search").addEventListener("input",e=>renderLibrary(e.target.value));
function bindGameCards(){$$("[data-game]").forEach(b=>b.addEventListener("click",()=>{const g=games.find(x=>x.id===b.dataset.game);if(g?.id==="neon")openGame();else toast(`${g.name} is coming soon. It is not playable in this build yet.`)}))}
bindGameCards();$("#hero-play").onclick=openGame;$("#store-play").onclick=openGame;$("#hero-more").onclick=()=>toast("Neon Breakout · Free browser arcade game · 1 player");

function showModal(id){const el=$(`#${id}`);el.hidden=false;el.querySelector("button")?.focus()}
function hideModal(id){$(`#${id}`).hidden=true}
$$("[data-close]").forEach(b=>b.onclick=()=>hideModal(b.dataset.close));
$("#settings-open").onclick=()=>showModal("settings-modal");
$("#pair-open").onclick=()=>openPairing();
$("#settings-pair").onclick=()=>{hideModal("settings-modal");openPairing()};
$("#focus-toggle").onchange=e=>document.body.classList.toggle("no-focus",!e.target.checked);
$("#motion-toggle").onchange=e=>document.body.classList.toggle("reduced-motion",e.target.checked);

async function openPairing(){showModal("pair-modal");$("#qr-wrap").innerHTML='<div class="qr-loading">Generating secure pairing…</div>';$("#pair-code").textContent="------";$("#pair-status").classList.remove("connected");$("#pair-status").innerHTML="<i></i> Waiting for phone…";try{const r=await fetch("/api/pair/create",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});if(!r.ok)throw Error("Server unavailable");const data=await r.json();pairCode=data.code;$("#pair-code").textContent=data.code;$("#qr-wrap").innerHTML=`<img alt="Phone controller pairing QR code" src="${data.qr}">`;connectTV(data.code)}catch(e){$("#qr-wrap").innerHTML='<div class="qr-loading">Pairing server unavailable</div>';toast("Start the PLAYBOX 5 server to enable phone pairing.")}}
function connectTV(code){tvSocket?.close();const scheme=location.protocol==="https:"?"wss":"ws";tvSocket=new WebSocket(`${scheme}://${location.host}/ws?role=tv&code=${code}`);tvSocket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==="controller-connected"){controllerConnected=true;$("#pair-status").classList.add("connected");$("#pair-status").innerHTML="<i></i> Phone connected — controller ready";$("#tv-status").innerHTML="<i></i> Phone controller connected";$("#settings-controller").textContent="Connected";toast("Phone controller connected.")}if(m.type==="controller-disconnected"){controllerConnected=false;$("#tv-status").innerHTML="<i></i> TV ready";$("#settings-controller").textContent="Not connected";toast("Phone controller disconnected.")}if(m.type==="input")handleRemoteInput(m)};tvSocket.onclose=()=>{if(pairCode===code){controllerConnected=false;$("#settings-controller").textContent="Not connected"}}}
function handleRemoteInput(m){const down=m.pressed;if(["left","right"].includes(m.button)){if(down){keys.add(m.button);if(game?.running)game.paddle.x+=m.button==="left"?-28:28}}if(m.button==="axis"&&down&&game?.running&&(m.axis==="left-x"||m.axis==="right-x")){game.paddle.x+=m.value*13}if(["confirm","cross"].includes(m.button)&&down){if($("#game-overlay").hidden)openGame();else if(!game?.running)startGame()}if(m.button==="back"&&down)closeGame();if(m.button==="pause"&&down)pauseGame()}
$("#pair-modal").addEventListener("transitionend",()=>{});
function openGame(){hideModal("pair-modal");$("#game-overlay").hidden=false;$("#game-start-card").hidden=false;$("#game-message").textContent="Ready to play?";$("#game-start").focus();drawAttract()}
$("#game-back").onclick=closeGame;
function closeGame(){stopGame();$("#game-overlay").hidden=true;setView("home")}
$("#game-start").onclick=startGame;

const canvas=$("#game-canvas"),ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height;
game={running:false,score:0,lives:3,paddle:{x:W/2-65,y:H-42,w:130,h:12},ball:{x:W/2,y:H-65,vx:4.2,vy:-4.6,r:8},bricks:[]};
function resetBricks(){game.bricks=[];for(let r=0;r<5;r++)for(let c=0;c<10;c++)game.bricks.push({x:76+c*82,y:65+r*30,w:68,h:17,alive:true,hue:185+r*22})}
function drawAttract(){ctx.clearRect(0,0,W,H);drawBackground();ctx.fillStyle="#77eaff";ctx.font="bold 18px Arial";ctx.textAlign="center";ctx.fillText("READY PLAYER ONE",W/2,H/2);drawPaddle();drawBall()}
function drawBackground(){ctx.fillStyle="#090d20";ctx.fillRect(0,0,W,H);ctx.strokeStyle="#172342";ctx.lineWidth=1;for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}}
function drawPaddle(){const p=game.paddle;ctx.shadowBlur=22;ctx.shadowColor="#72e6ff";ctx.fillStyle="#9af2ff";ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,7);ctx.fill();ctx.shadowBlur=0}
function drawBall(){const b=game.ball;ctx.shadowBlur=24;ctx.shadowColor="#ff5acb";ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
function drawGame(){drawBackground();game.bricks.forEach(br=>{if(!br.alive)return;ctx.fillStyle=`hsl(${br.hue} 90% 62%)`;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=12;ctx.beginPath();ctx.roundRect(br.x,br.y,br.w,br.h,4);ctx.fill()});ctx.shadowBlur=0;drawPaddle();drawBall();ctx.fillStyle="#d6e8ff";ctx.font="12px Arial";ctx.textAlign="left";ctx.fillText(`LIVES ${game.lives}`,25,H-20)}
function startGame(){game.running=true;game.score=0;game.lives=3;game.paddle.x=W/2-65;game.ball={x:W/2,y:H-65,vx:4.2,vy:-4.6,r:8};resetBricks();$("#score").textContent="000000";$("#game-start-card").hidden=true;cancelAnimationFrame(animationId);loop()}
function pauseGame(){if(!game.running)return;game.running=false;$("#game-start-card").hidden=false;$("#game-message").textContent="Paused";$("#game-start").textContent="Resume game ▶";$("#game-start").onclick=()=>{game.running=true;$("#game-start-card").hidden=true;loop()}}
function stopGame(){game.running=false;cancelAnimationFrame(animationId)}
function endGame(won){game.running=false;$("#game-start-card").hidden=false;$("#game-message").textContent=won?"Board cleared!":"Game over";$("#game-start").textContent="Play again ▶";$("#game-start").onclick=startGame;toast(won?"You cleared the board!":"Try again — you can beat that score.")}
function loop(){if(!game.running)return;const b=game.ball,p=game.paddle;b.x+=b.vx;b.y+=b.vy;if(b.x<b.r||b.x>W-b.r)b.vx*=-1;if(b.y<b.r)b.vy*=-1;if(b.vy>0&&b.y+b.r>=p.y&&b.x>=p.x&&b.x<=p.x+p.w){b.vy=-Math.abs(b.vy);b.vx+=((b.x-(p.x+p.w/2))/(p.w/2))*1.3}if(b.y>H){game.lives--;if(game.lives<=0){endGame(false);return}b.x=W/2;b.y=H-65;b.vy=-4.6;b.vx=4.2}for(const br of game.bricks){if(br.alive&&b.x>br.x&&b.x<br.x+br.w&&b.y-b.r<br.y+br.h&&b.y+b.r>br.y){br.alive=false;b.vy*=-1;game.score+=100;$("#score").textContent=String(game.score).padStart(6,"0");break}}if(game.bricks.every(x=>!x.alive)){endGame(true);return}p.x=Math.max(0,Math.min(W-p.w,p.x));if(keys.has("left"))p.x-=6;if(keys.has("right"))p.x+=6;drawGame();animationId=requestAnimationFrame(loop)}
function movePaddle(direction){if(game?.running)game.paddle.x+=direction*35}
function moveFocus(direction){const candidates=$$('button:not([disabled]),input:not([disabled])').filter(x=>x.offsetParent!==null&&!x.closest('[hidden]'));const current=document.activeElement;if(!candidates.includes(current)){candidates[0]?.focus();return}const a=current.getBoundingClientRect(),ax=a.left+a.width/2,ay=a.top+a.height/2;let best=null,bestScore=Infinity;for(const el of candidates){if(el===current)continue;const r=el.getBoundingClientRect(),dx=(r.left+r.width/2)-ax,dy=(r.top+r.height/2)-ay;const primary=direction==='left'?-dx:direction==='right'?dx:direction==='up'?-dy:dy;if(primary<=4)continue;const secondary=direction==='left'||direction==='right'?Math.abs(dy):Math.abs(dx);const score=primary+secondary*2.2;if(score<bestScore){best=el;bestScore=score}}best?.focus({preventScroll:false})}
function keyDown(e){const k=e.key.toLowerCase();if(["arrowleft","arrowright","arrowup","arrowdown"," ","escape","enter","backspace"].includes(k))e.preventDefault();if(["arrowleft","arrowright","arrowup","arrowdown"].includes(k)&&$("#game-overlay").hidden){moveFocus(k.replace("arrow",""));return}if(k==="arrowleft"||k==="a"){keys.add("left");movePaddle(-1)}if(k==="arrowright"||k==="d"){keys.add("right");movePaddle(1)}if((k===" "||k==="enter")&&!$("#game-overlay").hidden&&!game.running)startGame();if(k==="escape"||k==="backspace"){if(!$("#game-overlay").hidden)closeGame();else if(!$("#pair-modal").hidden)hideModal("pair-modal");else if(!$("#settings-modal").hidden)hideModal("settings-modal")}if(k==="enter"&&$("#game-overlay").hidden){const active=document.activeElement;if(active?.dataset?.view)setView(active.dataset.view);else active?.click?.()}}
function keyUp(e){const k=e.key.toLowerCase();if(k==="arrowleft"||k==="a")keys.delete("left");if(k==="arrowright"||k==="d")keys.delete("right")}
window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);
let pointerActive=false;canvas.addEventListener("pointermove",e=>{if(!game.running)return;const rect=canvas.getBoundingClientRect();game.paddle.x=((e.clientX-rect.left)/rect.width)*W-game.paddle.w/2});canvas.addEventListener("pointerdown",()=>{if(!game.running)startGame()});
function drawInitial(){drawAttract()}drawInitial();
document.addEventListener("keydown",e=>{if(e.key==="Tab"){const focusables=$$('button:not([disabled]),input:not([disabled])').filter(x=>x.offsetParent!==null);if(!focusables.includes(document.activeElement)&&focusables.length)focusables[0].focus()}});

const token = localStorage.getItem('medassist_token');
if(!token){ location.href='/login'; }

const recents = document.getElementById('recents');
const messages = document.getElementById('messages');
const query = document.getElementById('query');
const send = document.getElementById('send');
const voice = document.getElementById('voice');
const logout = document.getElementById('logout');
const newChat = document.getElementById('newChat');
const overlay = document.getElementById('overlay');
const overlayContent = document.getElementById('overlay-content');
const overlayToggle = document.getElementById('overlayToggle');
const modeTextbookBtn = document.getElementById('mode-textbook');
const modeOnlineBtn = document.getElementById('mode-online');

let chatList = []; let currentChatId = null;
let mode = localStorage.getItem('ui_chat_mode') || 'textbook';

function setMode(m){
	mode=m; localStorage.setItem('ui_chat_mode', m);
	modeTextbookBtn.classList.toggle('active',m==='textbook');
	modeOnlineBtn.classList.toggle('active',m==='online');
	currentChatId = null;
	messages.innerHTML = '';
	query.value = '';
	loadChats().then(()=>{
		// open recent chat for the mode if any
		const filtered = chatList.filter(c=>c.tag===(mode==='online'?'online':'textbook'));
		if(filtered.length) openChat(filtered[0].id);
	});
	renderList();
}
if(modeTextbookBtn) modeTextbookBtn.onclick = ()=>setMode('textbook');
if(modeOnlineBtn) modeOnlineBtn.onclick = ()=>setMode('online');
setMode(mode);

async function api(path, method='GET', body){
	const r = await fetch(path, {
		method,
		headers:{
			'Content-Type':'application/json',
			Authorization:`Bearer ${token}`
		},
		body: body?JSON.stringify(body):undefined
	});
	if(r.status === 401){
		localStorage.removeItem('medassist_token');
		location.href = '/login';
		return;
	}
	return r.json();
}

function createMsgEl(text, who){
	const wrap = document.createElement('div');
	wrap.className = `msg ${who}`;
	wrap.textContent = text;
	const ctr = document.createElement('div');
	ctr.className = 'controls';
	const read = document.createElement('button'); read.className='mini'; read.textContent='🔊 Read aloud'; read.dataset.action='read';
	const pause = document.createElement('button'); pause.className='mini'; pause.textContent='⏸ Pause'; pause.dataset.action='pause';
	ctr.appendChild(read); ctr.appendChild(pause);
	const outer = document.createElement('div');
	outer.appendChild(wrap); outer.appendChild(ctr);
	return outer;
}

function addMsg(text, who){
	const el = createMsgEl(text, who);
	messages.appendChild(el);
	messages.scrollTop = messages.scrollHeight;
}

messages.addEventListener('click',(e)=>{
	const btn = e.target.closest('button.mini'); if(!btn) return;
	const action = btn.dataset.action;
	const text = btn.parentElement.previousSibling.textContent||'';
	if(action==='read'){ speak(text, btn); }
	if(action==='pause'){ stopSpeak(); }
});

function speak(text, btn){
	try{ window.speechSynthesis.cancel(); }catch(_){ }
	const u = new (window.SpeechSynthesisUtterance||SpeechSynthesisUtterance)(text);
	u.rate = 1.05; u.pitch = 1; u.onend =()=>{ };
	window.speechSynthesis.speak(u);
}
function stopSpeak(){ try{ window.speechSynthesis.cancel(); }catch(_){ } }

function renderList(){
	recents.innerHTML='';
	const filtered = chatList.filter(c=>c.tag===(mode==='online'?'online':'textbook'));
	if(!filtered.length){ const d=document.createElement('div'); d.className='item'; d.textContent='No chats yet'; d.style.opacity=.7; recents.appendChild(d); return; }
	for(const c of filtered){ const it=document.createElement('div'); it.className='item'; it.dataset.id=c.id; it.textContent=c.title||'Untitled'; if(c.id===currentChatId) it.classList.add('active'); it.onclick=()=>openChat(c.id); recents.appendChild(it); }
}

async function loadChats(){ const res = await api('/api/chats/list'); chatList = res.chats||[]; renderList(); }

async function openChat(id){ const res = await api(`/api/chats/get?id=${encodeURIComponent(id)}`); if(!res.chat) return; currentChatId=res.chat.id; messages.innerHTML=''; for(const m of res.chat.messages){ addMsg(m.text, m.role==='user'?'user':'bot'); } renderList(); }

async function createChat(){ const res = await api('/api/chats/create','POST',{title:'New Chat',tag: mode==='online'?'online':'textbook'}); currentChatId=res.id; renderList(); messages.innerHTML=''; }

async function sendQuery(){
	if(!currentChatId) await createChat();
	const q = query.value.trim(); if(!q) return; query.value=''; addMsg(q,'user'); await api('/api/chats/append','POST',{id:currentChatId,role:'user',text:q,tag:mode==='online'?'online':'textbook'});
	addMsg('Thinking...','bot');
	try{
		let rag;
		if(mode==='textbook'){ rag = await api('/api/rag/query','POST',{query:q, topK:5}); }
		else{ rag = await api('/api/online','POST',{query:q}); }
		// Replace last bot text
		const lastBot = messages.querySelectorAll('.msg.bot');
		if(lastBot.length){ lastBot[lastBot.length-1].textContent = rag.answer || 'No answer.'; }
		await api('/api/chats/append','POST',{id:currentChatId,role:'bot',text: rag.answer || 'No answer.',tag:mode==='online'?'online':'textbook'});
		if(rag.matches && rag.matches.length){ overlayContent.innerHTML = rag.matches.map(m=>`<div style='margin-bottom:8px'><div style='color:#9bb0d3;font-size:12px'>${m.source}</div><div>${m.text}</div></div>`).join(''); overlay.hidden=false; }
		await loadChats();
	}catch(e){ const lastBot = messages.querySelectorAll('.msg.bot'); if(lastBot.length){ lastBot[lastBot.length-1].textContent='Error. Try again.'; }}
}

send.onclick = sendQuery; query.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendQuery(); }});
logout.onclick=()=>{ localStorage.clear(); location.href='/login'; };
newChat.onclick=()=>createChat();
overlayToggle.onclick=()=>{ overlay.hidden=!overlay.hidden; };

// Voice input via Web Speech API
let recognition=null, listening=false;
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){ const R=window.SpeechRecognition||window.webkitSpeechRecognition; recognition=new R(); recognition.lang='en-US'; recognition.interimResults=false; recognition.maxAlternatives=1; recognition.onstart=()=>{ listening=true; voice.classList.add('recording'); }; recognition.onend=()=>{ listening=false; voice.classList.remove('recording'); }; recognition.onerror=()=>{ listening=false; voice.classList.remove('recording'); }; recognition.onresult=(ev)=>{ const t=ev.results[0][0].transcript||''; query.value=t; query.focus(); }; }
voice.onclick=()=>{ if(!recognition){ alert('Voice input not supported in this browser.'); return; } try{ if(listening) recognition.stop(); else recognition.start(); }catch(_){} };

// Initial boot - don't call setMode here (it could overwrite)
(async function init(){ await loadChats();
	const filtered = chatList.filter(c=>c.tag===(mode==='online'?'online':'textbook'));
	if(filtered.length) openChat(filtered[0].id); })();

// main-empty/welcome view logic and clear chat handler
function updateWelcomeEmptyState(){
	const empty = document.getElementById('main-empty');
	const messages = document.getElementById('messages');
	const filtered = chatList.filter(c=>c.tag===(mode==='online'?'online':'textbook'));
	if (filtered.length === 0 && messages && messages.children.length===0) {
		empty && (empty.style.display = 'flex');
	} else {
		empty && (empty.style.display = 'none');
	}
}
// Patch renderList to trigger welcome update
const origRenderList = renderList;
renderList = function(){
	origRenderList.apply(this, arguments);
	updateWelcomeEmptyState();
}
// Patch openChat/createChat to trigger welcome update after render
const origOpenChat = openChat;
openChat = async function(id){ await origOpenChat.apply(this, arguments); updateWelcomeEmptyState(); }
const origCreateChat = createChat;
createChat = async function(){ await origCreateChat.apply(this, arguments); updateWelcomeEmptyState(); }

// Add Clear Chats functionality
const clearChatsBtn = document.getElementById('clearChats');
if(clearChatsBtn){
	clearChatsBtn.onclick = async () => {
		if(!confirm('Clear all chats?')) return;
		await api('/api/chats/clear', 'POST', {});
		await loadChats(); // this triggers renderList and updates sidebar and welcome
		currentChatId = null;
		messages.innerHTML = '';
		updateWelcomeEmptyState();
	};
}
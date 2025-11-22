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
const filterButtons = document.querySelectorAll('.filter-btn');
const suggestions = document.querySelectorAll('.suggestion');
const themeToggle = document.getElementById('themeToggle');
const sidebarToggle = document.getElementById('sidebarToggle');
const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
const sidebarCollapseToggle = document.getElementById('sidebarCollapseToggle');
const sidebar = document.querySelector('.sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const shell = document.getElementById('shell');

let chatList = []; let currentChatId = null;
let mode = localStorage.getItem('ui_chat_mode') || 'textbook';
let sidebarFilter = 'all';
const storedTheme = localStorage.getItem('ui_theme') || 'dark';
const DISCLAIMER_TEXT = 'Disclaimer: This information is for educational purposes only and is not a substitute for professional medical advice. Always consult a qualified healthcare provider for personalised guidance.';

function applyTheme(theme){
	const isLight = theme === 'light';
	document.body.classList.toggle('light-theme', isLight);
	if(themeToggle){ themeToggle.textContent = isLight ? '🌑 Dark Mode' : '🌙 Light Mode'; }
	localStorage.setItem('ui_theme', theme);
}

applyTheme(storedTheme);

if(themeToggle){
	themeToggle.addEventListener('click',()=>{
		const nextTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
		applyTheme(nextTheme);
	});
}

function updateSidebarFilterButtons(){ filterButtons.forEach(btn=> btn.classList.toggle('active', btn.dataset.filter===sidebarFilter)); }

function setSidebarFilter(f){
	sidebarFilter = f;
	updateSidebarFilterButtons();
	renderList();
}

filterButtons.forEach(btn=>{
	btn.addEventListener('click',()=>{
		const target = btn.dataset.filter;
		if(target==='textbook' || target==='online'){
			setMode(target);
			setSidebarFilter(target);
		}else if(target==='all'){
			setSidebarFilter('all');
		}
	});
});
if(filterButtons.length){ updateSidebarFilterButtons(); }

function setMode(m){
	mode=m; localStorage.setItem('ui_chat_mode', m);
	modeTextbookBtn.classList.toggle('active',m==='textbook');
	modeOnlineBtn.classList.toggle('active',m==='online');
	if(sidebarFilter!=='all'){
		sidebarFilter = m;
		updateSidebarFilterButtons();
	}
	currentChatId = null;
	messages.innerHTML = '';
	query.value = '';
	loadChats().then(()=>{
		// Don't open previous chat, show welcome screen instead
		updateWelcomeEmptyState();
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
	scrollToBottom();
}

function scrollToBottom(){
	const mainBody = document.querySelector('.main-body');
	if(mainBody){
		// Use requestAnimationFrame to ensure layout is updated
		requestAnimationFrame(() => {
			mainBody.scrollTop = mainBody.scrollHeight;
		});
	}
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
	let filtered = chatList;
	if(sidebarFilter==='textbook' || sidebarFilter==='online'){
		filtered = chatList.filter(c=>c.tag===sidebarFilter);
	}else if(sidebarFilter!=='all'){
		filtered = chatList.filter(c=>c.tag===(mode==='online'?'online':'textbook'));
	}
	if(!filtered.length){ const d=document.createElement('div'); d.className='item'; d.textContent='No chats yet'; d.style.opacity=.7; recents.appendChild(d); return; }
	for(const c of filtered){ const it=document.createElement('div'); it.className='item'; it.dataset.id=c.id; it.textContent=c.title||'Untitled'; if(c.id===currentChatId) it.classList.add('active'); it.onclick=()=>openChat(c.id); recents.appendChild(it); }
}

function formatSourceForAnswer(src){
	if(!src) return null;
	try{
		const url = new URL(src);
		return `- ${url.hostname}: ${url.href}`;
	}catch(_){
		return `- ${src}`;
	}
}

function clearOverlayContext() {
    overlayContent.innerHTML = '';
    overlay.setAttribute('hidden', '');
    overlayToggle.style.display = 'none';
}

async function loadChats(){ const res = await api('/api/chats/list'); chatList = res.chats||[]; renderList(); }

async function openChat(id){ 
    const res = await api(`/api/chats/get?id=${encodeURIComponent(id)}`); 
    if(!res.chat) return; 
    currentChatId=res.chat.id; 
    messages.innerHTML=''; 
    for(const m of res.chat.messages){ 
        addMsg(m.text, m.role==='user'?'user':'bot'); 
    } 
    renderList(); 
    scrollToBottom();
    clearOverlayContext(); // Clear context when switching chats
}

async function createChat(){ 
    const res = await api('/api/chats/create','POST',{title:'New Chat',tag: mode==='online'?'online':'textbook'}); 
    currentChatId=res.id; 
    renderList(); 
    messages.innerHTML='';
    clearOverlayContext(); // Clear context for new chat
}
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
		if(lastBot.length){
			const matches = Array.isArray(rag.matches) ? rag.matches : [];
			let finalAnswer = (rag.answer || 'No answer.').trim();
			if(mode==='online'){
				const sourceLines = matches.map(m=>formatSourceForAnswer(m.source)).filter(Boolean);
				if(sourceLines.length){
					finalAnswer += `\n\nSources:\n${sourceLines.join('\n')}`;
				}else{
					finalAnswer += `\n\nSources: Not available.`;
				}
			}
			finalAnswer += `\n\n${DISCLAIMER_TEXT}`;
			lastBot[lastBot.length-1].textContent = finalAnswer;
			await api('/api/chats/append','POST',{id:currentChatId,role:'bot',text: finalAnswer,tag:mode==='online'?'online':'textbook'});
		}
		if(rag.matches && rag.matches.length){
			overlayContent.innerHTML = rag.matches.map(m=>{
				const snippet = m.text ? `<div>${m.text}</div>` : '';
				return `<div style='margin-bottom:8px'><div style='color:#9bb0d3;font-size:12px'>${m.source||'Source'}</div>${snippet}</div>`;
			}).join('');
			overlay.setAttribute('hidden', '');
			overlayToggle.style.display = 'flex'; // Show button when context exists
		} else {
			clearOverlayContext(); // Hide button when no context
		}
		await loadChats();
	}catch(e){ const lastBot = messages.querySelectorAll('.msg.bot'); if(lastBot.length){ lastBot[lastBot.length-1].textContent=`Error. Try again.\n\n${DISCLAIMER_TEXT}`; }}
}

send.onclick = sendQuery; query.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendQuery(); }});
logout.onclick=()=>{ localStorage.clear(); location.href='/login'; };
newChat.onclick=()=>createChat();
overlayToggle.onclick=()=>{ 
    if(overlay.hasAttribute('hidden')){
        overlay.removeAttribute('hidden');
    } else {
        overlay.setAttribute('hidden', '');
    }
};

// Voice input via Web Speech API
let recognition=null, listening=false;
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){ const R=window.SpeechRecognition||window.webkitSpeechRecognition; recognition=new R(); recognition.lang='en-US'; recognition.interimResults=false; recognition.maxAlternatives=1; recognition.onstart=()=>{ listening=true; voice.classList.add('recording'); }; recognition.onend=()=>{ listening=false; voice.classList.remove('recording'); }; recognition.onerror=()=>{ listening=false; voice.classList.remove('recording'); }; recognition.onresult=(ev)=>{ const t=ev.results[0][0].transcript||''; query.value=t; query.focus(); }; }
voice.onclick=()=>{ if(!recognition){ alert('Voice input not supported in this browser.'); return; } try{ if(listening) recognition.stop(); else recognition.start(); }catch(_){} };

// Initial boot - don't call setMode here (it could overwrite)
(async function init(){ 
	await loadChats();
	// Don't open previous chat, show welcome screen instead
	updateWelcomeEmptyState();
})();

// main-empty/welcome view logic and clear chat handler
function updateWelcomeEmptyState(){
	const empty = document.getElementById('main-empty');
	const messages = document.getElementById('messages');
	// Show welcome screen when there are no messages displayed
	// This happens when: new login, mode switch, new chat, or no active chat
	if (messages && messages.children.length === 0) {
		empty && (empty.style.display = 'flex');
		messages && messages.classList.add('hidden');
	} else {
		empty && (empty.style.display = 'none');
		messages && messages.classList.remove('hidden');
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

suggestions.forEach(btn=>{
	btn.addEventListener('click',()=>{
		const text = btn.dataset.query || btn.textContent;
		query.value = text.trim();
		sendQuery();
	});
});

// Sidebar toggle for mobile
const toggleSidebar = (open) => {
	if(window.innerWidth <= 960){
		if(open){
			sidebar.classList.add('open');
			if(sidebarBackdrop) sidebarBackdrop.classList.add('active');
			// Prevent body scroll when sidebar is open
			document.body.style.overflow = 'hidden';
		} else {
			sidebar.classList.remove('open');
			if(sidebarBackdrop) sidebarBackdrop.classList.remove('active');
			// Restore body scroll
			document.body.style.overflow = '';
		}
	}
};

if(sidebar && (sidebarToggle || mobileSidebarToggle)){
	// Mobile menu button (in header)
	if(mobileSidebarToggle){
		mobileSidebarToggle.addEventListener('click', (e)=>{
			e.stopPropagation();
			const isOpen = sidebar.classList.contains('open');
			toggleSidebar(!isOpen);
		});
	}
	
	// Sidebar toggle button (inside sidebar - for desktop)
	if(sidebarToggle){
		sidebarToggle.addEventListener('click', (e)=>{
			e.stopPropagation();
			if(window.innerWidth > 960){
				// Desktop: toggle collapsed state
				shell.classList.toggle('collapsed');
			} else {
				// Mobile: close sidebar
				toggleSidebar(false);
			}
		});
	}
	
	// Collapse toggle button (floating button when sidebar is collapsed - desktop only)
	if(sidebarCollapseToggle){
		sidebarCollapseToggle.addEventListener('click', (e)=>{
			e.stopPropagation();
			if(window.innerWidth > 960){
				// Desktop: expand sidebar
				shell.classList.remove('collapsed');
			}
		});
	}
	
	// Close sidebar when clicking on backdrop
	if(sidebarBackdrop){
		sidebarBackdrop.addEventListener('click', ()=>{
			toggleSidebar(false);
		});
	}
	
	// Close sidebar when clicking outside on mobile
	document.addEventListener('click', (e)=>{
		if(window.innerWidth <= 960){
			if(sidebar.classList.contains('open') && 
			   !sidebar.contains(e.target) && 
			   !mobileSidebarToggle.contains(e.target) &&
			   (!sidebarToggle || !sidebarToggle.contains(e.target))){
				toggleSidebar(false);
			}
		}
	});
	
	// Close sidebar when clicking on a chat item on mobile
	const origOpenChat = openChat;
	openChat = async function(id){
		await origOpenChat.apply(this, arguments);
		if(window.innerWidth <= 960){
			toggleSidebar(false);
		}
	};
	
	// Close sidebar when creating new chat on mobile
	const currentCreateChat = createChat;
	createChat = async function(){
		await currentCreateChat.apply(this, arguments);
		if(window.innerWidth <= 960){
			toggleSidebar(false);
		}
	};
	
	// Close sidebar when clicking new chat button on mobile
	if(newChat){
		const origNewChatClick = newChat.onclick;
		newChat.onclick = function(){
			if(origNewChatClick) origNewChatClick();
			if(window.innerWidth <= 960){
				toggleSidebar(false);
			}
		};
	}
	
	// Handle window resize - close sidebar if switching from mobile to desktop
	window.addEventListener('resize', () => {
		if(window.innerWidth > 960){
			// Desktop view - ensure sidebar is not in mobile open state
			sidebar.classList.remove('open');
			if(sidebarBackdrop) sidebarBackdrop.classList.remove('active');
			document.body.style.overflow = '';
		}
	});
}
// Global token check - allow access but show warning for unauthenticated users
const token = localStorage.getItem('medassist_token');
// No redirect - allow unauthenticated access to quick-chat

// Wait for DOM to be ready
function initChatApp(){
	const recents = document.getElementById('recents');
	const messages = document.getElementById('messages');
	const query = document.getElementById('query');
	const send = document.getElementById('send');
	
	// Check if required elements exist (quick-chat page)
	if(!recents || !messages || !query || !send){
		// Not on quick-chat page, exit silently
		return;
	}
	
	// All elements exist, proceed with initialization
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
	const overlayClose = document.getElementById('overlayClose');
	
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
	
	function updateSidebarFilterButtons(){ 
		if(filterButtons && filterButtons.length){
			filterButtons.forEach(btn=> btn.classList.toggle('active', btn.dataset.filter===sidebarFilter)); 
		}
	}
	
	function setSidebarFilter(f){
		sidebarFilter = f;
		updateSidebarFilterButtons();
		renderList();
	}
	
	if(filterButtons && filterButtons.length){
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
		updateSidebarFilterButtons();
	}
	
	function setMode(m){
		mode=m; localStorage.setItem('ui_chat_mode', m);
		if(modeTextbookBtn) modeTextbookBtn.classList.toggle('active',m==='textbook');
		if(modeOnlineBtn) modeOnlineBtn.classList.toggle('active',m==='online');
		if(sidebarFilter!=='all'){
			sidebarFilter = m;
			updateSidebarFilterButtons();
		}
		currentChatId = null;
		if(messages) messages.innerHTML = '';
		if(query) query.value = '';
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
	const headers = {
		'Content-Type':'application/json'
	};
	if(token){
		headers.Authorization = `Bearer ${token}`;
	}
	const r = await fetch(path, {
		method,
		headers,
		body: body?JSON.stringify(body):undefined
	});
	if(r.status === 401){
		localStorage.removeItem('medassist_token');
		// Don't redirect - allow unauthenticated access
		return {error: 'Unauthorized'};
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
    
    // Update welcome state after adding message
    updateWelcomeEmptyState();
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
	for(const c of filtered){ 
		const it=document.createElement('div'); 
		it.className='item'; 
		it.dataset.id=c.id; 
		
		// Create title span
		const titleSpan = document.createElement('span');
		titleSpan.className = 'item-title';
		titleSpan.textContent = c.title||'Untitled';
		titleSpan.onclick = (e) => {
			e.stopPropagation();
			openChat(c.id);
		};
		
		// Create three-dot menu button
		const menuBtn = document.createElement('button');
		menuBtn.className = 'item-menu-btn';
		menuBtn.innerHTML = '⋯';
		menuBtn.setAttribute('aria-label', 'Chat options');
		menuBtn.onclick = (e) => {
			e.stopPropagation();
			toggleChatMenu(menuBtn, c.id);
		};
		
		// Create menu dropdown
		const menu = document.createElement('div');
		menu.className = 'item-menu';
		menu.style.display = 'none';
		
		const deleteBtn = document.createElement('button');
		deleteBtn.className = 'item-menu-option delete-option';
		deleteBtn.innerHTML = '🗑️ Delete';
		deleteBtn.onclick = async (e) => {
			e.stopPropagation();
			menu.style.display = 'none';
			await deleteChat(c.id);
		};
		
		menu.appendChild(deleteBtn);
		
		it.appendChild(titleSpan);
		it.appendChild(menuBtn);
		it.appendChild(menu);
		
		// Ensure item has position relative for menu positioning
		it.style.position = 'relative';
		
		// Handle click on item (but not on menu button or menu)
		it.onclick = (e) => {
			if(!e.target.closest('.item-menu-btn') && !e.target.closest('.item-menu')){
				openChat(c.id);
			}
		};
		
		if(c.id===currentChatId) it.classList.add('active');
		recents.appendChild(it);
	}
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

async function loadChats(){ 
	if(!token){
		chatList = [];
		renderList();
		return;
	}
	const res = await api('/api/chats/list'); 
	chatList = res.chats||[]; 
	renderList(); 
}

function toggleChatMenu(menuBtn, chatId){
	// Close all other menus
	document.querySelectorAll('.item-menu').forEach(m => {
		if(m !== menuBtn.nextElementSibling){
			m.style.display = 'none';
		}
	});
	
	const menu = menuBtn.nextElementSibling;
	if(menu && menu.classList.contains('item-menu')){
		menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
	}
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
	if(!e.target.closest('.item-menu-btn') && !e.target.closest('.item-menu')){
		document.querySelectorAll('.item-menu').forEach(m => {
			m.style.display = 'none';
		});
	}
});

async function deleteChat(chatId){
	if(!confirm('Are you sure you want to delete this chat?')){
		return;
	}
	
	try{
		const res = await fetch(`/api/chats/delete?id=${encodeURIComponent(chatId)}`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			}
		});
		
		if(res.status === 401){
			localStorage.removeItem('medassist_token');
			location.href = '/login';
			return;
		}
		
		const data = await res.json();
		
		if(data.ok || res.ok){
			// If deleted chat was current, clear it
			if(currentChatId === chatId){
				currentChatId = null;
				messages.innerHTML = '';
				updateWelcomeEmptyState();
			}
			await loadChats();
		} else {
			alert('Failed to delete chat. Please try again.');
		}
	}catch(error){
		console.error('Delete error:', error);
		alert('Failed to delete chat. Please try again.');
	}
}

async function openChat(id){ 
	if(!token){
		// Unauthenticated users can't open saved chats
		return;
	}
    const res = await api(`/api/chats/get?id=${encodeURIComponent(id)}`); 
    if(!res.chat) return; 
    currentChatId=res.chat.id; 
    window.currentChatId = currentChatId;
    messages.innerHTML=''; 
    for(const m of res.chat.messages){ 
        addMsg(m.text, m.role==='user'?'user':'bot'); 
    } 
    renderList(); 
    scrollToBottom();
    clearOverlayContext(); // Clear context when switching chats
}

async function createChat(){ 
	if(!token){
		// For unauthenticated users, use a temporary session ID
		currentChatId = 'temp_' + Date.now();
		window.currentChatId = currentChatId;
		messages.innerHTML='';
		clearOverlayContext();
		return;
	}
    const res = await api('/api/chats/create','POST',{title:'New Chat',tag: mode==='online'?'online':'textbook'}); 
    currentChatId=res.id; 
    window.currentChatId = currentChatId;
    renderList(); 
    messages.innerHTML='';
    clearOverlayContext(); // Clear context for new chat
}
async function sendQuery(){
	if(!currentChatId) await createChat();
    const q = query.value.trim();
    if(!q) return;

    const lowerQ = q.toLowerCase();
    addMsg(q, 'user'); // ALWAYS display user input in the chat

    if(['hi','hello','hey','good morning','good afternoon','good evening'].includes(lowerQ)){
        addMsg("Hello! How can I assist you today? 😊", "bot");
        query.value = "";
        return;
    }
    if(['thanks','thank you','thank you!','thanks!','thx','thankyou'].includes(lowerQ)){
        addMsg("You're very welcome! Let me know if you have any other questions. 🙏", "bot");
        query.value = "";
        return;
    }
    if(['bye','goodbye','see you','farewell'].includes(lowerQ)){
        addMsg("Take care! If you have more questions later, just say hi again. 👋", "bot");
        query.value = "";
        return;
    }

    // For all other queries, save user's message to chat (already displayed above)
    if(token && currentChatId && !currentChatId.startsWith('temp_')){
        await api('/api/chats/append','POST',{id:currentChatId,role:'user',text:q,tag:mode==='online'?'online':'textbook'});
    }
    
    addMsg('Thinking...','bot'); // Show thinking message
    
    try{
        let rag;
        if(mode==='textbook'){ 
            rag = await api('/api/rag/query','POST',{query:q, topK:5}); 
        } else { 
            if(!token){
                addMsg('Advanced mode requires login. Please login to use this feature.', 'bot');
                query.value = '';
                return;
            }
            rag = await api('/api/online','POST',{query:q}); 
        }
        
        // Replace last bot text
        const lastBot = messages.querySelectorAll('.msg.bot');
        if(lastBot.length){
            const matches = Array.isArray(rag.matches) ? rag.matches : [];
            let finalAnswer = (rag.answer || 'No answer.').trim();
            
            if(mode==='online'){
                const sourceLines = matches.map(m=>formatSourceForAnswer(m.source)).filter(Boolean);
                if(sourceLines.length){
                    finalAnswer += `\n\nSources:\n${sourceLines.join('\n')}`;
                } else {
                    finalAnswer += `\n\nSources: Not available.`;
                }
            }
            
            finalAnswer += `\n\n${DISCLAIMER_TEXT}`;
            lastBot[lastBot.length-1].textContent = finalAnswer;
            if(token && currentChatId && !currentChatId.startsWith('temp_')){
                await api('/api/chats/append','POST',{id:currentChatId,role:'bot',text: finalAnswer,tag:mode==='online'?'online':'textbook'});
            }
        }
        
        if(rag.matches && rag.matches.length){
            overlayContent.innerHTML = rag.matches.map(m=>{
                const snippet = m.text ? `<div>${m.text}</div>` : '';
                return `<div style='margin-bottom:8px'><div style='color:#9bb0d3;font-size:12px'>${m.source||'Source'}</div>${snippet}</div>`;
            }).join('');
            overlay.setAttribute('hidden', '');
            overlayToggle.style.display = 'flex';
        } else {
            overlayToggle.style.display = 'none';
        }
        
        // Clear input field after sending
        query.value = '';
        
        await loadChats();
    } catch(e) { 
        const lastBot = messages.querySelectorAll('.msg.bot'); 
        if(lastBot.length){ 
            lastBot[lastBot.length-1].textContent=`Error. Try again.\n\n${DISCLAIMER_TEXT}`; 
        }
        // Clear input field even on error
        query.value = '';
    }
}

	send.onclick = sendQuery; 
	query.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendQuery(); }});
	if(logout) logout.onclick=()=>{ 
		if(token){
			localStorage.clear(); 
			location.href='/login'; 
		} else {
			location.href='/login';
		}
	};
	
	// Add Delete Account functionality
	const deleteAccountBtn = document.getElementById('deleteAccount');
	if(deleteAccountBtn){
		deleteAccountBtn.onclick = async () => {
			if(!token){
				alert('Please login to delete your account');
				return;
			}
			
			const confirmMsg = 'Are you sure you want to delete your account? This will permanently delete your account and ALL your chats. This action cannot be undone.';
			if(!confirm(confirmMsg)){
				return;
			}
			
			// Double confirmation
			if(!confirm('This is your last chance. Are you absolutely sure you want to delete your account?')){
				return;
			}
			
			try{
				const res = await fetch('/api/auth/delete', {
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${token}`
					}
				});
				
				if(res.status === 401){
					localStorage.removeItem('medassist_token');
					location.href = '/login';
					return;
				}
				
				const data = await res.json();
				
				if(data.ok || res.ok){
					alert('Your account and all chats have been deleted successfully.');
					localStorage.clear();
					location.href = '/login';
				} else {
					alert(data.error || 'Failed to delete account. Please try again.');
				}
			}catch(error){
				console.error('Delete account error:', error);
				alert('An error occurred while deleting your account. Please try again.');
			}
		};
	}
	
	if(newChat) newChat.onclick=()=>createChat();
	if(overlayToggle) overlayToggle.onclick=()=>{ 
		if(overlay.hasAttribute('hidden')){
			overlay.removeAttribute('hidden');
		} else {
			overlay.setAttribute('hidden', '');
		}
	};
	if(overlayClose && overlay){
		overlayClose.onclick = () => overlay.setAttribute('hidden', '');
	}

	// Voice input via Web Speech API
	let recognition=null, listening=false;
	if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){ const R=window.SpeechRecognition||window.webkitSpeechRecognition; recognition=new R(); recognition.lang='en-US'; recognition.interimResults=false; recognition.maxAlternatives=1; recognition.onstart=()=>{ listening=true; voice.classList.add('recording'); }; recognition.onend=()=>{ listening=false; voice.classList.remove('recording'); }; recognition.onerror=()=>{ listening=false; voice.classList.remove('recording'); }; recognition.onresult=(ev)=>{ const t=ev.results[0][0].transcript||''; query.value=t; query.focus(); }; }
	voice.onclick=()=>{ if(!recognition){ alert('Voice input not supported in this browser.'); return; } try{ if(listening) recognition.stop(); else recognition.start(); }catch(_){} };
	
	// Hide sidebar history for unauthenticated users
	if(!token){
		const recents = document.getElementById('recents');
		const sidebarFilters = document.querySelector('.sidebar-filters');
		const clearChatsBtn = document.getElementById('clearChats');
		if(recents) recents.style.display = 'none';
		if(sidebarFilters) sidebarFilters.style.display = 'none';
		if(clearChatsBtn) clearChatsBtn.style.display = 'none';
	}
	
	// Initial boot - don't call setMode here (it could overwrite)
	(async function init(){ 
		await loadChats();
		// Don't open previous chat, show welcome screen instead
		updateWelcomeEmptyState();
	})();
	
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
	} // End of if(sidebar && (sidebarToggle || mobileSidebarToggle))
	
	// Initial boot - don't call setMode here (it could overwrite)
	(async function init(){ 
		await loadChats();
		// Don't open previous chat, show welcome screen instead
		updateWelcomeEmptyState();
	})();
	
	// Function to attach suggestion click handlers
	function attachSuggestionHandlers(){
		const allSuggestions = document.querySelectorAll('.suggestion');
		allSuggestions.forEach(btn=>{
			// Skip if already has handler
			if(btn.dataset.hasHandler === 'true') return;
			btn.dataset.hasHandler = 'true';
			
			btn.addEventListener('click', async ()=>{
				const text = btn.dataset.query || btn.textContent;
				if(btn.dataset.chatId){
					// This is a previous chat bubble
					await openChat(btn.dataset.chatId);
				} else {
					// This is a suggestion
					query.value = text.trim();
					await sendQuery();
				}
			});
		});
	}
	
	// main-empty/welcome view logic and clear chat handler
	function updateWelcomeEmptyState(){
		const empty = document.getElementById('main-empty');
		const messages = document.getElementById('messages');
		// Show welcome screen when there are no messages displayed
		// This happens when: new login, mode switch, new chat, or no active chat
		if (messages && messages.children.length === 0) {
			empty && (empty.style.display = 'flex');
			messages && messages.classList.add('hidden');
			
			// Keep only default suggestions - no previous chats here
			const suggestionsDiv = empty.querySelector('.suggestions');
			if(suggestionsDiv){
				// Attach handlers to suggestions
				setTimeout(attachSuggestionHandlers, 50);
			}
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
	const origOpenChat2 = openChat;
	openChat = async function(id){ await origOpenChat2.apply(this, arguments); updateWelcomeEmptyState(); }
	const origCreateChat2 = createChat;
	createChat = async function(){ await origCreateChat2.apply(this, arguments); updateWelcomeEmptyState(); }
	
	// Add Clear Chats functionality
	const clearChatsBtn = document.getElementById('clearChats');
	if(clearChatsBtn){
		clearChatsBtn.onclick = async () => {
			if(!token){
				alert('Please login to clear chats');
				return;
			}
			if(!confirm('Clear all chats?')) return;
			await api('/api/chats/clear', 'POST', {});
			await loadChats(); // this triggers renderList and updates sidebar and welcome
			currentChatId = null;
			messages.innerHTML = '';
			updateWelcomeEmptyState();
		};
	}
	
} // End of initChatApp function

// Initialize when DOM is ready
if(document.readyState === 'loading'){
	document.addEventListener('DOMContentLoaded', initChatApp);
} else {
	initChatApp();
}

// At the bottom after messages and chat logic
// Add a button to manually end the session and view results
let endSessionBtn = null;
function showEndSessionButton() {
    if (!endSessionBtn) {
        endSessionBtn = document.createElement('button');
        endSessionBtn.textContent = 'View Results';
        endSessionBtn.className = 'btn results-btn';
        endSessionBtn.style.margin = '24px auto 0';
        endSessionBtn.onclick = function() {
            if(currentChatId) window.location.href = `/static/results.html?id=${encodeURIComponent(currentChatId)}`;
        };
    }
    // Add below composer if not already present
    const c = document.querySelector('.composer');
    if (c && !endSessionBtn.parentElement) {
        c.parentElement.appendChild(endSessionBtn);
    }
}

// For now, ALWAYS show the button if a chat exists
// You may later want to trigger on specific phrase or button
setInterval(()=>{
    if(currentChatId){
        showEndSessionButton();
    }
}, 1500);
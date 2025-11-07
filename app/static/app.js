let token = null;

const chat = document.getElementById('chat');
const queryInput = document.getElementById('query');
const sendBtn = document.getElementById('send');
const overlay = document.getElementById('overlay');
const overlayContent = document.getElementById('overlay-content');

function addMessage(text, who) {
	const div = document.createElement('div');
	div.className = `message ${who}`;
	div.textContent = text;
	chat.appendChild(div);
	chat.scrollTop = chat.scrollHeight;
}

async function api(path, method = 'GET', body) {
	const res = await fetch(path, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	return res.json();
}

sendBtn.onclick = async () => {
	const q = queryInput.value.trim();
	if (!q) return;
	addMessage(q, 'user');
	queryInput.value = '';
	addMessage('Thinking...', 'bot');
	const res = await api('/api/rag/query', 'POST', { query: q, topK: 5 });
	chat.lastChild.textContent = res.answer || 'No answer.';
	if (res.matches && res.matches.length) {
		overlayContent.innerHTML = res.matches.map(m => `<div style='margin-bottom:8px'><div style='color:#9bb0d3;font-size:12px'>${m.source}</div><div>${m.text}</div></div>`).join('');
		overlay.hidden = false;
	}
};

document.getElementById('register').onclick = async () => {
	const email = document.getElementById('email').value.trim();
	const password = document.getElementById('password').value;
	const res = await api('/api/auth/register', 'POST', { email, password });
	if (res.error) alert(res.error); else alert('Registered! Now login.');
};

document.getElementById('login').onclick = async () => {
	const email = document.getElementById('email').value.trim();
	const password = document.getElementById('password').value;
	const res = await api('/api/auth/login', 'POST', { email, password });
	if (res.access_token) { token = res.access_token; alert('Logged in'); } else { alert(res.error || 'Login failed'); }
};

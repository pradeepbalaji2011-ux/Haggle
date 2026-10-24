/**
 * public/js/chatbot/chatbot.js — Haggle Assistant Chat Widget
 * Floating chatbot panel with streaming AI responses, voice I/O
 */

const CHAT_CHIPS = [
  { label: '🔥 Trending today', msg: "What's trending today?" },
  { label: '💰 Best deals', msg: "What are the best deals right now?" },
  { label: '📈 Track a product', msg: "How do I track a product's price?" },
  { label: '🤔 Should I buy now?', msg: "Should I buy now or wait?" },
  { label: '🛍️ How to use Haggle', msg: 'How do I use Haggle?' }
];

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url, fallback = '#') {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  // Only allow https:// or site relative paths (/ or #)
  if (trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return escapeHtml(trimmed);
  }
  return fallback;
}

class HaggleAssistant {
  constructor() {
    this.messages = [];
    this.isMuted = localStorage.getItem('haggle_chat_muted') === 'true';
    this.isRecording = false;
    this.speechRecognition = null;
    this.currentAudio = null;
    this.isOpen = false;
    this.isStreaming = false;
    this.render();
  }

  render() {
    // Inject CSS link if not already present
    if (!document.getElementById('chatbot-css')) {
      const link = document.createElement('link');
      link.id = 'chatbot-css';
      link.rel = 'stylesheet';
      link.href = '/css/chatbot.css';
      document.head.appendChild(link);
    }

    // Create FAB button
    this.fab = document.createElement('button');
    this.fab.className = 'chat-fab';
    this.fab.setAttribute('aria-label', 'Open Haggle Assistant');
    this.fab.innerHTML = '<span class="chat-fab-icon">💬</span>';
    this.fab.addEventListener('click', () => this.togglePanel());
    document.body.appendChild(this.fab);

    // Create Chat Panel
    this.panel = document.createElement('div');
    this.panel.className = 'chat-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Haggle Assistant Chat');
    this.panel.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-left">
          <div class="chat-avatar">🛒</div>
          <div class="chat-header-info">
            <h4>Haggle Assistant</h4>
            <span id="chatStatus">Your shopping guide</span>
          </div>
        </div>
        <div class="chat-header-actions">
          <button class="chat-header-btn chat-speaker-btn ${this.isMuted ? 'muted' : ''}" id="chatSpeakerBtn" title="${this.isMuted ? 'Unmute voice' : 'Mute voice'}">${this.isMuted ? '🔇' : '🔊'}</button>
          <button class="chat-header-btn" id="chatCloseBtn" title="Close chat">✕</button>
        </div>
      </div>
      <div class="chat-messages" id="chatMessages"></div>
      <div class="chat-typing" id="chatTyping" style="display:none;">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
      <div class="chat-chips" id="chatChips">
        ${CHAT_CHIPS.map(c => `<button class="chat-chip" data-msg="${escapeHtml(c.msg)}">${escapeHtml(c.label)}</button>`).join('')}
      </div>
      <div class="chat-input-bar">
        <input class="chat-input" id="chatInput" type="text" placeholder="Ask about prices, deals..." maxlength="500" autocomplete="off" />
        <button class="chat-action-btn chat-mic-btn" id="chatMicBtn" title="Voice input">🎤</button>
        <button class="chat-action-btn chat-send-btn" id="chatSendBtn" title="Send">➤</button>
      </div>
    `;
    document.body.appendChild(this.panel);

    // Wire up events
    this.panel.querySelector('#chatCloseBtn').addEventListener('click', () => this.closePanel());
    this.panel.querySelector('#chatSendBtn').addEventListener('click', () => this.sendMessage());
    this.panel.querySelector('#chatInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
    });
    this.panel.querySelector('#chatSpeakerBtn').addEventListener('click', () => this.toggleMute());
    this.panel.querySelector('#chatMicBtn').addEventListener('click', () => this.toggleMic());
    this.panel.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const msg = chip.getAttribute('data-msg');
        if (msg) this.sendMessage(msg);
      });
    });

    // Show welcome message after a brief delay
    setTimeout(() => {
      if (this.messages.length === 0) {
        this.addBotMessage("Namaste! 👋 I'm Haggle Assistant. I can help you find the best prices across 15 Indian stores.\n\nAsk me anything about products, deals or price trends!");
      }
    }, 500);
  }

  togglePanel() {
    if (this.isOpen) this.closePanel();
    else this.openPanel();
  }

  openPanel() {
    this.isOpen = true;
    this.panel.classList.add('open');
    this.fab.classList.add('open');
    this.fab.innerHTML = '<span class="chat-fab-icon">✕</span>';
    setTimeout(() => this.panel.querySelector('#chatInput')?.focus(), 300);
    this.scrollToBottom();
  }

  closePanel() {
    this.isOpen = false;
    this.panel.classList.remove('open');
    this.fab.classList.remove('open');
    this.fab.innerHTML = '<span class="chat-fab-icon">💬</span>';
  }

  addMessage(role, content) {
    const messagesEl = this.panel.querySelector('#chatMessages');
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (role === 'user') {
      this.messages.push({ role, content });
      if (this.messages.length > 20) this.messages = this.messages.slice(-20);
    }

    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg ${role}`;
    msgEl.dataset.id = msgId;

    const avatar = role === 'bot' ? '🛒' : '👤';
    const formatted = this.formatContent(content);

    msgEl.innerHTML = `
      <div class="msg-avatar">${avatar}</div>
      <div class="msg-bubble">${formatted}</div>
    `;
    messagesEl.appendChild(msgEl);
    this.scrollToBottom();
    return msgEl;
  }

  addBotMessage(content) {
    const msgEl = this.addMessage('bot', content);
    if (!this.isMuted) this.speakText(content);
    return msgEl;
  }

  formatContent(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  scrollToBottom() {
    const el = this.panel.querySelector('#chatMessages');
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }

  showTyping() {
    const el = this.panel.querySelector('#chatTyping');
    if (el) el.style.display = 'flex';
    this.scrollToBottom();
  }

  hideTyping() {
    const el = this.panel.querySelector('#chatTyping');
    if (el) el.style.display = 'none';
  }

  async sendMessage(overrideText) {
    if (this.isStreaming) return;
    const input = this.panel.querySelector('#chatInput');
    const text = overrideText || input?.value?.trim();
    if (!text) return;

    if (input && !overrideText) input.value = '';

    // Show user message
    this.addMessage('user', text);
    this.showTyping();
    this.isStreaming = true;

    // Disable send button while streaming
    const sendBtn = this.panel.querySelector('#chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    // Build message history for API (role must be 'assistant' for bot in OpenAI-compatible format)
    const historyForApi = this.messages.slice(-10).map(m => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.content
    }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForApi, stream: true })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.hideTyping();

      // Create a streaming message bubble
      const messagesEl = this.panel.querySelector('#chatMessages');
      const streamEl = document.createElement('div');
      streamEl.className = 'chat-msg bot';
      streamEl.innerHTML = `<div class="msg-avatar">🛒</div><div class="msg-bubble" id="streamBubble"></div>`;
      messagesEl.appendChild(streamEl);
      const bubble = streamEl.querySelector('#streamBubble');

      let fullText = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Stream parsing loop
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullText += data.token;
              bubble.innerHTML = this.formatContent(fullText);
              this.scrollToBottom();
            }
            if (data.done) {
              this.messages.push({ role: 'bot', content: fullText });
              if (data.cards && data.cards.length > 0) {
                this.renderCards(bubble, data.cards);
              }
              if (data.miniChart && data.miniChart.length > 0) {
                this.renderMiniChart(bubble, data.miniChart);
              }
              if (data.chips && data.chips.length > 0) {
                this.renderChips(data.chips);
              }
              const speechText = data.spokenSummary || fullText;
              if (!this.isMuted) this.speakText(speechText);
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }

    } catch (err) {
      this.hideTyping();
      this.addBotMessage("I'm having trouble connecting right now. Please try again in a moment, or search directly on Haggle for instant price comparisons!");
      console.warn('[HaggleAssistant] Stream error:', err.message);
    } finally {
      this.isStreaming = false;
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  renderCards(bubble, cards) {
    if (!cards || cards.length === 0) return;
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'chat-product-cards';
    cards.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'chat-product-card';

      const safeName = escapeHtml(card.name || 'Product');
      const safeStore = escapeHtml(card.store || 'Store');
      const safeRating = card.rating ? escapeHtml(card.rating) : null;
      const safeImage = sanitizeUrl(card.image, '/images/placeholder.png');
      const targetUrl = card.haggleUrl || card.buyUrl;
      const safeUrl = sanitizeUrl(targetUrl, '#');
      const targetAttr = (targetUrl && (targetUrl.startsWith('/') || targetUrl.startsWith('#'))) ? '_self' : '_blank';
      const formattedPrice = escapeHtml(card.formattedPrice || (card.price ? '₹' + card.price.toLocaleString('en-IN') : ''));

      cardEl.innerHTML = `
        <img class="chat-card-img" src="${safeImage}" alt="${safeName}" onerror="this.src='/images/placeholder.png'">
        <div class="chat-card-details">
          <div class="chat-card-title" title="${safeName}">${safeName}</div>
          <div class="chat-card-price-row">
            ${formattedPrice ? `<span class="chat-card-price">${formattedPrice}</span>` : ''}
            <span class="chat-card-badge">${safeStore}</span>
            ${safeRating ? `<span class="chat-card-badge">★ ${safeRating}</span>` : ''}
          </div>
        </div>
        <a class="chat-card-btn" href="${safeUrl}" target="${targetAttr}" rel="noopener noreferrer">View ↗</a>
      `;
      cardsContainer.appendChild(cardEl);
    });
    bubble.appendChild(cardsContainer);
    this.scrollToBottom();
  }

  renderMiniChart(bubble, points) {
    if (!points || points.length < 2) return;
    const chartBox = document.createElement('div');
    chartBox.className = 'chat-mini-chart-box';

    const prices = points.map(p => p.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = (maxP - minP) || 1;

    // SVG coordinates
    const w = 300;
    const h = 70;
    const pad = 12;

    const coords = points.map((p, idx) => {
      const x = pad + (idx / (points.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((p.price - minP) / range) * (h - 2 * pad);
      return { x, y, price: p.price, date: p.date };
    });

    const pathData = coords.reduce((acc, c, idx) => {
      return idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
    }, '');

    // Area fill path
    const areaData = `${pathData} L ${coords[coords.length - 1].x} ${h} L ${coords[0].x} ${h} Z`;

    chartBox.innerHTML = `
      <div class="chat-chart-header">
        <span class="chat-chart-title">📈 Price Trend</span>
        <span class="chat-chart-badge">₹${minP.toLocaleString('en-IN')} – ₹${maxP.toLocaleString('en-IN')}</span>
      </div>
      <div class="chat-svg-wrapper">
        <svg class="chat-svg-chart" viewBox="0 0 ${w} ${h}">
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#22C55E" stop-opacity="0.25"/>
              <stop offset="100%" stop-color="#22C55E" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <path d="${areaData}" fill="url(#chartGrad)"/>
          <path d="${pathData}" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round"/>
          ${coords.map(c => `
            <circle cx="${c.x}" cy="${c.y}" r="3.5" fill="#ffffff" stroke="#22C55E" stroke-width="2">
              <title>${escapeHtml(c.date)}: ₹${c.price.toLocaleString('en-IN')}</title>
            </circle>
          `).join('')}
        </svg>
      </div>
    `;
    bubble.appendChild(chartBox);
    this.scrollToBottom();
  }

  renderChips(chips) {
    if (!chips || chips.length === 0) return;
    const chipsEl = this.panel.querySelector('#chatChips');
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    chips.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'chat-chip';
      btn.textContent = c.label;
      btn.setAttribute('data-msg', c.msg || c.label);
      btn.addEventListener('click', () => {
        const msg = btn.getAttribute('data-msg');
        if (msg) this.sendMessage(msg);
      });
      chipsEl.appendChild(btn);
    });
  }

  async speakText(text) {
    if (this.isMuted) return;
    // Strip markdown and HTML, truncate to 300 chars for TTS
    const plainText = text
      .replace(/\*\*/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .slice(0, 300);

    // Try Piper TTS first (server-side offline)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plainText })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio = null; }
        this.currentAudio = new Audio(url);
        this.currentAudio.play().catch(() => this.speakWithBrowser(plainText));
        this.currentAudio.onended = () => URL.revokeObjectURL(url);
        return;
      }
    } catch { /* fall through to browser TTS */ }

    this.speakWithBrowser(plainText);
  }

  speakWithBrowser(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 1.0;
    utterance.pitch = 1.1;

    // Auto-select a female voice if available
    const tryVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return; // Voices not loaded yet
      const preferredVoices = ['Google UK English Female', 'Microsoft Heera', 'Microsoft Zira', 'Samantha'];
      const femaleVoice = voices.find(v => preferredVoices.some(name => v.name.includes(name))) ||
        voices.find(v => v.lang.includes('en') && v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.lang.includes('en'));
      if (femaleVoice) utterance.voice = femaleVoice;
    };

    // Voices may not be ready immediately; retry if needed
    if (window.speechSynthesis.getVoices().length > 0) {
      tryVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => { tryVoice(); window.speechSynthesis.onvoiceschanged = null; };
    }

    window.speechSynthesis.speak(utterance);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('haggle_chat_muted', String(this.isMuted));
    const btn = this.panel.querySelector('#chatSpeakerBtn');
    if (btn) {
      btn.textContent = this.isMuted ? '🔇' : '🔊';
      btn.classList.toggle('muted', this.isMuted);
      btn.title = this.isMuted ? 'Unmute voice' : 'Mute voice';
    }
    if (this.isMuted) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio = null; }
    }
  }

  toggleMic() {
    if (this.isRecording) this.stopMic();
    else this.startMic();
  }

  startMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.addBotMessage('Speech recognition is not supported in your browser. Please use Chrome or Edge for voice input. 🎤');
      return;
    }

    this.speechRecognition = new SpeechRecognition();
    this.speechRecognition.lang = 'en-IN';
    this.speechRecognition.continuous = false;
    this.speechRecognition.interimResults = false;

    this.speechRecognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const input = this.panel.querySelector('#chatInput');
      if (input) input.value = transcript;
      this.stopMic();
      this.sendMessage();
    };

    this.speechRecognition.onerror = (e) => {
      console.warn('[HaggleAssistant] Mic error:', e.error);
      this.stopMic();
    };
    this.speechRecognition.onend = () => { if (this.isRecording) this.stopMic(); };

    try {
      this.speechRecognition.start();
      this.isRecording = true;
      const micBtn = this.panel.querySelector('#chatMicBtn');
      if (micBtn) { micBtn.classList.add('recording'); micBtn.title = 'Stop recording'; }
      const status = this.panel.querySelector('#chatStatus');
      if (status) status.textContent = 'Listening...';
    } catch (err) {
      console.warn('[HaggleAssistant] Could not start mic:', err.message);
      this.isRecording = false;
    }
  }

  stopMic() {
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch { /* ignore */ }
      this.speechRecognition = null;
    }
    this.isRecording = false;
    const micBtn = this.panel.querySelector('#chatMicBtn');
    if (micBtn) { micBtn.classList.remove('recording'); micBtn.title = 'Voice input'; }
    const status = this.panel.querySelector('#chatStatus');
    if (status) status.textContent = 'Your shopping guide';
  }
}

// Singleton initialization
let chatbotInstance = null;

export function initChatbot() {
  if (!chatbotInstance) {
    chatbotInstance = new HaggleAssistant();
  }
  return chatbotInstance;
}

// Auto-init when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}

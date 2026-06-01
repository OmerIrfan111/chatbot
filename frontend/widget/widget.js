/**
 * AI Support Agent — Embeddable Chat Widget
 *
 * Usage:
 *   <script
 *     src="/widget.js"
 *     data-api-url="http://localhost:8000"
 *     data-tenant-id="default"
 *     data-api-key="demo-key"
 *     data-title="Support"
 *     data-color="#6B3AC6"
 *   ></script>
 */

(function () {
  "use strict";

  // ── Read data attributes from the script tag ────────────────────────────
  var script = document.currentScript;
  var cfg = {
    apiUrl:     script.getAttribute("data-api-url")     || "http://localhost:8000",
    tenantId:   script.getAttribute("data-tenant-id")   || "default",
    apiKey:     script.getAttribute("data-api-key")     || "demo-key",
    title:      script.getAttribute("data-title")       || "Support",
    color:      script.getAttribute("data-color")       || "#6B3AC6",
    greeting:   script.getAttribute("data-greeting")    || "Hi! How can I help you today?",
    placeholder: script.getAttribute("data-placeholder") || "Type your question…",
  };

  // ── State ───────────────────────────────────────────────────────────────
  var token = null;
  var sessionId = "widget-" + Math.random().toString(36).slice(2, 10);
  var messages = [];
  var open = false;
  var streaming = false;
  var abortController = null;

  // ── DOM construction ────────────────────────────────────────────────────

  var styles = document.createElement("style");
  styles.textContent = `
    .aws-widget * { box-sizing: border-box; }
    .aws-widget-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      width: 56px; height: 56px; border-radius: 50%;
      background: ${cfg.color}; color: #fff; border: none; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .aws-widget-btn:hover { transform: scale(1.05); box-shadow: 0 6px 24px rgba(0,0,0,0.25); }
    .aws-widget-btn svg { width: 24px; height: 24px; }
    .aws-widget-btn.open { transform: rotate(45deg); }
    .aws-widget-box {
      position: fixed; bottom: 92px; right: 24px; z-index: 999999;
      width: 380px; max-height: 600px; height: 60vh;
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      display: flex; flex-direction: column;
      overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px; color: #1A1A1A;
      transform-origin: bottom right;
      animation: aws-slide-up 0.25s ease-out;
    }
    @keyframes aws-slide-up {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .aws-widget-header {
      padding: 16px 20px; background: ${cfg.color}; color: #fff; 
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .aws-widget-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    .aws-widget-close {
      background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer;
      padding: 4px; border-radius: 6px; display: flex;
    }
    .aws-widget-close:hover { background: rgba(255,255,255,0.15); color: #fff; }
    .aws-widget-messages {
      flex: 1; overflow-y: auto; padding: 16px 20px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .aws-widget-msg {
      max-width: 85%; padding: 10px 14px; border-radius: 12px;
      line-height: 1.45; font-size: 13.5px; word-wrap: break-word;
      animation: aws-fade-in 0.2s ease-out;
    }
    @keyframes aws-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .aws-user {
      align-self: flex-end; background: ${cfg.color}; color: #fff;
      border-bottom-right-radius: 4px;
    }
    .aws-bot {
      align-self: flex-start; background: #F3F3F3; color: #1A1A1A;
      border-bottom-left-radius: 4px;
    }
    .aws-typing {
      display: flex; gap: 4px; padding: 12px 16px; align-items: center;
    }
    .aws-typing span {
      width: 7px; height: 7px; border-radius: 50%; background: #CCCCCC;
      animation: aws-bounce 1.2s ease-in-out infinite;
    }
    .aws-typing span:nth-child(2) { animation-delay: 0.2s; }
    .aws-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes aws-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }
    .aws-widget-input {
      padding: 12px 16px; border-top: 1px solid #E2E2E2;
      display: flex; gap: 8px; flex-shrink: 0;
    }
    .aws-widget-input textarea {
      flex: 1; border: none; resize: none; outline: none; font-size: 13.5px;
      font-family: inherit; padding: 6px 0; line-height: 1.4;
      max-height: 80px; color: #1A1A1A;
    }
    .aws-widget-input textarea::placeholder { color: #AAAAAA; }
    .aws-widget-input button {
      background: ${cfg.color}; color: #fff; border: none;
      width: 36px; height: 36px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity 0.15s;
    }
    .aws-widget-input button:disabled { opacity: 0.4; cursor: default; }
    .aws-widget-input button svg { width: 16px; height: 16px; }
    .aws-widget-sources {
      display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;
    }
    .aws-widget-source {
      font-size: 10px; padding: 2px 8px; border-radius: 999px;
      background: #F0F0F0; color: #555555; border: 1px solid #E2E2E2;
    }
    .aws-error {
      padding: 16px 20px; text-align: center; color: #DC2626; font-size: 13px;
    }
    @media (max-width: 480px) {
      .aws-widget-box {
        width: calc(100vw - 32px); right: 16px; bottom: 84px;
        max-height: calc(100vh - 120px); height: auto;
      }
    }
  `;
  document.head.appendChild(styles);

  // ── Build DOM ───────────────────────────────────────────────────────────

  var btn = document.createElement("button");
  btn.className = "aws-widget-btn";
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  document.body.appendChild(btn);

  var box = document.createElement("div");
  box.className = "aws-widget-box";
  box.style.display = "none";
  box.innerHTML =
    '<div class="aws-widget-header">' +
      '<h3>' + escapeHtml(cfg.title) + '</h3>' +
      '<button class="aws-widget-close" aria-label="Close">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="aws-widget-messages" id="aws-messages">' +
      '<div class="aws-widget-msg aws-bot">' + escapeHtml(cfg.greeting) + '</div>' +
    '</div>' +
    '<div class="aws-widget-input">' +
      '<textarea id="aws-input" placeholder="' + escapeHtml(cfg.placeholder) + '" rows="1"></textarea>' +
      '<button id="aws-send" aria-label="Send">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
      '</button>' +
    '</div>';

  document.body.appendChild(box);

  var messagesEl = document.getElementById("aws-messages");
  var inputEl = document.getElementById("aws-input");
  var sendEl = document.getElementById("aws-send");

  // ── Helpers ─────────────────────────────────────────────────────────────

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, text) {
    var div = document.createElement("div");
    div.className = "aws-widget-msg " + (role === "user" ? "aws-user" : "aws-bot");
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function showTyping() {
    var div = document.createElement("div");
    div.className = "aws-widget-msg aws-bot aws-typing";
    div.id = "aws-typing";
    div.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function hideTyping() {
    var el = document.getElementById("aws-typing");
    if (el) el.remove();
  }

  // ── Auth ────────────────────────────────────────────────────────────────

  function getToken() {
    if (token) return Promise.resolve(token);
    return fetch(cfg.apiUrl + "/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: cfg.tenantId, api_key: cfg.apiKey }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("Auth failed");
        return r.json();
      })
      .then(function (d) {
        token = d.access_token;
        return token;
      });
  }

  // ── Send message ────────────────────────────────────────────────────────

  function sendMessage(text) {
    if (streaming || !text.trim()) return;
    var q = text.trim();
    inputEl.value = "";
    inputEl.style.height = "auto";
    addMessage("user", q);
    showTyping();
    streaming = true;
    sendEl.disabled = true;

    abortController = new AbortController();

    getToken()
      .then(function (tok) {
        return fetch(cfg.apiUrl + "/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + tok,
          },
          body: JSON.stringify({
            question: q,
            session_id: sessionId,
          }),
          signal: abortController.signal,
        });
      })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        hideTyping();

        var answerDiv = document.createElement("div");
        answerDiv.className = "aws-widget-msg aws-bot";
        messagesEl.appendChild(answerDiv);
        scrollToBottom();

        function pump() {
          return reader.read().then(function (result) {
            if (result.done) { streaming = false; sendEl.disabled = false; return; }
            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (var i = 0; i < lines.length; i++) {
              var line = lines[i];
              if (!line.startsWith("data: ")) continue;
              try {
                var evt = JSON.parse(line.slice(6));
                if (evt.type === "token") {
                  answerDiv.textContent += evt.content;
                  scrollToBottom();
                } else if (evt.type === "done") {
                  streaming = false;
                  sendEl.disabled = false;
                  // Add sources as small chips
                  if (evt.sources && evt.sources.length > 0) {
                    var srcDiv = document.createElement("div");
                    srcDiv.className = "aws-widget-sources";
                    evt.sources.slice(0, 3).forEach(function (s) {
                      var chip = document.createElement("span");
                      chip.className = "aws-widget-source";
                      chip.textContent = s.filename + (s.page ? " p." + s.page : "");
                      srcDiv.appendChild(chip);
                    });
                    messagesEl.appendChild(srcDiv);
                    scrollToBottom();
                  }
                } else if (evt.type === "error") {
                  hideTyping();
                  addMessage("bot", "Sorry, something went wrong.");
                  streaming = false;
                  sendEl.disabled = false;
                }
              } catch (_) {}
            }
            return pump();
          });
        }

        return pump();
      })
      .catch(function (err) {
        if (err.name === "AbortError") return;
        hideTyping();
        addMessage("bot", "Connection error. Please try again.");
        streaming = false;
        sendEl.disabled = false;
      });
  }

  // ── Event listeners ─────────────────────────────────────────────────────

  btn.addEventListener("click", function () {
    open = !open;
    if (open) {
      box.style.display = "flex";
      btn.className += " open";
      inputEl.focus();
    } else {
      box.style.display = "none";
      btn.className = "aws-widget-btn";
    }
  });

  box.querySelector(".aws-widget-close").addEventListener("click", function () {
    open = false;
    box.style.display = "none";
    btn.className = "aws-widget-btn";
  });

  sendEl.addEventListener("click", function () {
    sendMessage(inputEl.value);
  });

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value);
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 80) + "px";
  });
})();

// Configuration
const DEFAULT_LM_PROXY_URL = "http://localhost:4000/openai/v1";
const FALLBACK_LM_PROXY_URL = "http://localhost:4000/v1";
const DEFAULT_MODEL = "vscode-lm-proxy";

// State
let activeMode = "lm-proxy"; // "lm-proxy" | "gemini-nano"
let activeBaseUrl = DEFAULT_LM_PROXY_URL;
let selectedModel = DEFAULT_MODEL;
let aiModel = null; // Gemini Nano reference if available
let currentSummary = "";
let currentRisks = "";
let chatHistory = [];
let chatSessionNano = null;
let analyzedText = "";

// DOM Elements
const onboardingPanel = document.getElementById("onboarding-panel");
const appContainer = document.getElementById("app-container");
const btnRecheck = document.getElementById("btn-recheck");
const btnFallbackNano = document.getElementById("btn-fallback-nano");
const modelSelect = document.getElementById("model-select");
const statusIndicator = document.getElementById("status-indicator");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

const btnAnalyzeTab = document.getElementById("btn-analyze-tab");
const btnAnalyzeText = document.getElementById("btn-analyze-text");
const textInput = document.getElementById("text-input");

const navSummary = document.getElementById("nav-summary");
const navRisks = document.getElementById("nav-risks");
const navChat = document.getElementById("nav-chat");

const summaryTextContainer = document.getElementById("summary-text");
const risksListContainer = document.getElementById("risks-list");

const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const btnChatSend = document.getElementById("btn-chat-send");

const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupCopyButtons();
  setupModelSelect();

  await initEngine();

  // Setup Event Listeners
  btnRecheck.addEventListener("click", async () => {
    btnRecheck.disabled = true;
    btnRecheck.innerText = "Checking...";
    const ok = await initEngine();
    btnRecheck.disabled = false;
    btnRecheck.innerText = "Retry Connection";
    if (ok) showApp();
  });

  if (btnFallbackNano) {
    btnFallbackNano.addEventListener("click", () => {
      activeMode = "gemini-nano";
      updateStatusDisplay("connected", "Gemini Nano");
      showApp();
    });
  }

  btnAnalyzeTab.addEventListener("click", analyzeActiveTab);
  btnAnalyzeText.addEventListener("click", analyzePastedText);
  btnChatSend.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
});

// Setup Model Selector
function setupModelSelect() {
  if (!modelSelect) return;
  
  // Load saved preference
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["selectedModel", "activeBaseUrl"], (data) => {
      if (data.selectedModel) {
        selectedModel = data.selectedModel;
        ensureOptionExists(modelSelect, selectedModel);
        modelSelect.value = selectedModel;
      }
      if (data.activeBaseUrl) {
        activeBaseUrl = data.activeBaseUrl;
      }
    });
  }

  modelSelect.addEventListener("change", (e) => {
    selectedModel = e.target.value;
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ selectedModel });
    }
  });
}

function ensureOptionExists(selectEl, value) {
  for (let i = 0; i < selectEl.options.length; i++) {
    if (selectEl.options[i].value === value) return;
  }
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = value;
  selectEl.appendChild(opt);
}

// Helper to log debug info
function logDebug(msg) {
  const el = document.getElementById("debug-info");
  if (el) {
    el.innerText += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  }
}

// Engine Initialization & Health Checks
async function initEngine() {
  logDebug("Checking LM Proxy connection at " + DEFAULT_LM_PROXY_URL + "...");
  
  const proxyConnected = await checkAndInitLMProxy();
  if (proxyConnected) {
    activeMode = "lm-proxy";
    updateStatusDisplay("connected", selectedModel);
    showApp();
    return true;
  }

  logDebug("LM Proxy unreachable. Checking Gemini Nano capabilities...");
  const nanoAvailable = await checkNanoAvailability();
  if (nanoAvailable) {
    logDebug("Gemini Nano detected. Fallback option available.");
    if (btnFallbackNano) btnFallbackNano.classList.remove("hidden");
  } else {
    if (btnFallbackNano) btnFallbackNano.classList.add("hidden");
  }

  updateStatusDisplay("disconnected", "Offline");
  showOnboarding();
  return false;
}

// Check LM Proxy and fetch models list
async function checkAndInitLMProxy() {
  const candidateUrls = [DEFAULT_LM_PROXY_URL, FALLBACK_LM_PROXY_URL];

  for (const url of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${url}/models`, {
        signal: controller.signal,
        headers: { "Authorization": "Bearer not-needed" }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        activeBaseUrl = url;
        logDebug(`Connected to LM Proxy at: ${url}`);
        
        try {
          const data = await res.json();
          if (data && Array.isArray(data.data) && data.data.length > 0) {
            populateModelSelect(data.data.map(m => m.id));
          } else {
            populateModelSelect([DEFAULT_MODEL]);
          }
        } catch (_) {
          populateModelSelect([DEFAULT_MODEL]);
        }
        return true;
      }
    } catch (err) {
      logDebug(`Probe failed for ${url}: ${err.message}`);
    }
  }
  return false;
}

function populateModelSelect(models) {
  if (!modelSelect) return;
  modelSelect.innerHTML = "";

  models.forEach(modelId => {
    const opt = document.createElement("option");
    opt.value = modelId;
    opt.textContent = modelId;
    modelSelect.appendChild(opt);
  });

  // Preserve previously selected or default to vscode-lm-proxy
  if (models.includes(selectedModel)) {
    modelSelect.value = selectedModel;
  } else if (models.includes(DEFAULT_MODEL)) {
    selectedModel = DEFAULT_MODEL;
    modelSelect.value = DEFAULT_MODEL;
  } else if (models.length > 0) {
    selectedModel = models[0];
    modelSelect.value = selectedModel;
  }
}

function updateStatusDisplay(status, label) {
  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${status}`;
    statusIndicator.title = `Status: ${status} (${label || ""})`;
  }
}

// Check for Prompt API (Gemini Nano) capabilities as optional fallback
async function checkNanoAvailability() {
  let target = null;
  if (typeof ai !== "undefined") {
    target = ai;
  } else if (typeof window.ai !== "undefined") {
    target = window.ai;
  } else if (typeof chrome !== "undefined" && chrome.aiLanguageModel) {
    aiModel = chrome.aiLanguageModel;
  } else if (typeof LanguageModel !== "undefined") {
    try {
      const availability = await LanguageModel.availability();
      if (availability !== "no") {
        aiModel = {
          create: (opts) => LanguageModel.create(opts),
          availability: () => Promise.resolve(availability)
        };
        return true;
      }
    } catch (_) {}
  }

  if (target) {
    if (target.languageModel) aiModel = target.languageModel;
    else if (target.assistant) aiModel = target.assistant;
  }

  if (!aiModel) return false;

  try {
    if (typeof aiModel.availability === "function") {
      const avail = await aiModel.availability();
      return avail !== "no";
    } else if (typeof aiModel.capabilities === "function") {
      const caps = await aiModel.capabilities();
      return caps.available !== "no";
    }
    return true;
  } catch (_) {
    return false;
  }
}

function showOnboarding() {
  onboardingPanel.classList.remove("hidden");
  appContainer.classList.add("hidden");
}

function showApp() {
  onboardingPanel.classList.add("hidden");
  appContainer.classList.remove("hidden");
}

// Tab Navigation Configuration
function setupTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;

      const targetTab = btn.getAttribute("data-tab");

      tabButtons.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(targetTab).classList.add("active");
    });
  });
}

// Copy Buttons
function setupCopyButtons() {
  document.querySelectorAll(".btn-copy").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        navigator.clipboard.writeText(targetEl.innerText)
          .then(() => {
            const originalText = btn.innerText;
            btn.innerText = "Copied";
            btn.style.color = "var(--accent-success)";
            setTimeout(() => {
              btn.innerText = originalText;
              btn.style.color = "";
            }, 1500);
          })
          .catch(err => console.error("Copy failed", err));
      }
    });
  });
}

// UI State Toggles during loading
function showLoading(text) {
  loadingText.innerText = text;
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

// Active Tab Scraping
async function analyzeActiveTab() {
  showLoading("Reading webpage content...");
  try {
    const content = await getActiveTabContent();
    if (!content || content.trim().length === 0) {
      throw new Error("The webpage contains no readable text.");
    }
    await processText(content);
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    hideLoading();
  }
}

async function analyzePastedText() {
  const content = textInput.value;
  if (!content || content.trim().length === 0) {
    alert("Please paste some terms & conditions first.");
    return;
  }
  showLoading("Processing text...");
  try {
    await processText(content);
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    hideLoading();
  }
}

// Scrape page text via scripting API stripping noise elements
async function getActiveTabContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("No active tab found.");

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const clone = document.body.cloneNode(true);
        const noise = clone.querySelectorAll("script, style, noscript, nav, header, footer, aside, svg, form, iframe");
        noise.forEach(el => el.remove());
        const main = clone.querySelector("main") || clone.querySelector("article") || clone;
        return (main.innerText || main.textContent || "").trim();
      }
    });

    if (!results || !results[0]) {
      throw new Error("Could not extract page text.");
    }
    return results[0].result;
  } catch (e) {
    console.error("Tab content scraping failed:", e);
    throw new Error("Failed to read webpage content. Ensure you are on a standard web page and the extension has tab permissions.");
  }
}

// Unified LLM Invocation
async function executeLLM(systemPrompt, userPrompt) {
  if (activeMode === "lm-proxy") {
    const response = await fetch(`${activeBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer not-needed"
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`LM Proxy (${response.status}): ${errBody || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "No output returned.";
  } else if (activeMode === "gemini-nano") {
    const session = await aiModel.create({ systemPrompt });
    const output = await session.prompt(userPrompt);
    session.destroy();
    return output.trim();
  }
  throw new Error("No active LLM engine configured.");
}

// Core Text Processing Pipeline
async function processText(text) {
  // Preserve beginning (definitions/scope) and end (dispute/arbitration/liability/termination)
  const maxLength = 16000;
  if (text.length > maxLength) {
    const headLength = 10000;
    const tailLength = 5000;
    analyzedText = text.substring(0, headLength) + 
      "\n\n[... middle sections omitted for length limitations ...]\n\n" + 
      text.substring(text.length - tailLength);
  } else {
    analyzedText = text;
  }

  // Reset conversation states
  chatHistory = [];
  chatSessionNano = null;
  chatMessages.innerHTML = "";

  showLoading(`Analyzing: Generating Summary (${selectedModel})...`);
  try {
    const summaryPrompt = "You are an AI legal assistant. Provide a concise, high-level summary (3-4 sentences) of the provided terms and conditions text. Do not use legal jargon. Focus on what this service is, key user commitments, and consent.";
    currentSummary = await executeLLM(summaryPrompt, analyzedText);
    summaryTextContainer.innerText = currentSummary;
  } catch (err) {
    console.error("Summary failed:", err);
    currentSummary = `Error generating summary: ${err.message}`;
    summaryTextContainer.innerText = currentSummary;
  }

  showLoading(`Analyzing: Extracting Risks (${selectedModel})...`);
  try {
    const risksPrompt = "You are an AI legal assistant. Based on the terms and conditions text, list the top 7 most offensive, one-sided, or risky clauses. Format the output strictly as a markdown bulleted list, where each bullet contains a concise one-line explanation of the clause. Do not use legal jargon.";
    currentRisks = await executeLLM(risksPrompt, analyzedText);
    risksListContainer.innerHTML = formatMarkdownList(currentRisks);
  } catch (err) {
    console.error("Risks extraction failed:", err);
    currentRisks = `Error extracting risk clauses: ${err.message}`;
    risksListContainer.innerText = currentRisks;
  }

  // Initialize chat history context with full analyzed document
  chatHistory = [
    {
      role: "system",
      content: `You are an AI legal assistant analyzing this Terms and Conditions document. You must ONLY answer questions directly related to this document. If the question is irrelevant, refuse to answer politely. Keep answers clear, accurate, and concise without unnecessary legal jargon.\n\nDocument Context:\n${analyzedText}`
    }
  ];

  // Enable navigation tabs
  navSummary.removeAttribute("disabled");
  navRisks.removeAttribute("disabled");
  navChat.removeAttribute("disabled");

  // Switch to summary tab
  switchToTab("tab-summary");
}

function switchToTab(tabId) {
  tabButtons.forEach(btn => {
    if (btn.getAttribute("data-tab") === tabId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  tabContents.forEach(content => {
    if (content.id === tabId) {
      content.classList.add("active");
    } else {
      content.classList.remove("active");
    }
  });
}

function formatMarkdownList(text) {
  const lines = text.split("\n");
  let html = "<ul>";
  let itemAdded = false;

  lines.forEach(line => {
    const cleanLine = line.trim().replace(/^[-*+]\s+/, "");
    if (cleanLine.length > 0 && line.trim().match(/^[-*+]\s+/)) {
      html += `<li>${escapeHtml(cleanLine)}</li>`;
      itemAdded = true;
    }
  });

  html += "</ul>";
  return itemAdded ? html : `<p>${escapeHtml(text)}</p>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Chat Implementation
async function sendChatMessage() {
  const query = chatInput.value.trim();
  if (!query) return;

  // Append user message to UI
  appendMessage("user", query);
  chatInput.value = "";

  const responsePlaceholder = appendMessage("assistant", "Thinking...");

  try {
    if (activeMode === "lm-proxy") {
      chatHistory.push({ role: "user", content: query });

      const response = await fetch(`${activeBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer not-needed"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: chatHistory,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "No response received.";
      chatHistory.push({ role: "assistant", content: reply });
      responsePlaceholder.innerText = reply;
    } else if (activeMode === "gemini-nano") {
      if (!chatSessionNano) {
        showLoading("Initializing chat context...");
        try {
          chatSessionNano = await aiModel.create({
            systemPrompt: `You are an AI legal assistant. You are chatting about this Terms and Conditions document. You must ONLY answer questions directly related to this document. If the question is irrelevant, refuse to answer politely. Here is the context of the terms: ${analyzedText}`
          });
        } finally {
          hideLoading();
        }
      }
      const reply = await chatSessionNano.prompt(query);
      responsePlaceholder.innerText = reply;
    }
  } catch (err) {
    console.error("Chat prompting error:", err);
    responsePlaceholder.innerText = `Error: ${err.message}. Ensure LM Proxy is running on localhost:4000.`;
  }
}

function appendMessage(role, text) {
  const el = document.createElement("div");
  el.className = `message ${role}`;
  el.innerText = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

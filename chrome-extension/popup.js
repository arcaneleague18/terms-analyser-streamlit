// Globals
let aiModel = null;
let currentSummary = "";
let currentRisks = "";
let chatSession = null;
let analyzedText = "";

// DOM Elements
const onboardingPanel = document.getElementById("onboarding-panel");
const appContainer = document.getElementById("app-container");
const btnRecheck = document.getElementById("btn-recheck");

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
  
  const available = await checkAndInitAI();
  if (!available) {
    showOnboarding();
  } else {
    showApp();
  }

  // Setup Event Listeners
  btnRecheck.addEventListener("click", async () => {
    const ok = await checkAndInitAI();
    if (ok) showApp();
  });

  btnAnalyzeTab.addEventListener("click", analyzeActiveTab);
  btnAnalyzeText.addEventListener("click", analyzePastedText);
  btnChatSend.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
});

// Helper to log debug info directly to screen
function logDebug(msg) {
  const el = document.getElementById("debug-info");
  if (el) {
    el.innerText += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  }
}

// Check for Prompt API capabilities
async function checkAndInitAI() {
  logDebug("Starting AI capability check...");
  
  let target = null;
  if (typeof ai !== "undefined") {
    logDebug("Found global 'ai' object");
    target = ai;
  } else if (typeof window.ai !== "undefined") {
    logDebug("Found 'window.ai' object");
    target = window.ai;
  } else if (typeof chrome !== "undefined" && chrome.ai) {
    logDebug("Found 'chrome.ai' object");
    target = chrome.ai;
  } else if (typeof chrome !== "undefined" && chrome.aiOriginTrial) {
    logDebug("Found 'chrome.aiOriginTrial' object");
    target = chrome.aiOriginTrial;
  } else if (typeof chrome !== "undefined" && chrome.aiLanguageModel) {
    logDebug("Found 'chrome.aiLanguageModel' object");
    aiModel = chrome.aiLanguageModel;
  } else if (typeof LanguageModel !== "undefined") {
    logDebug("Found global 'LanguageModel' class!");
    try {
      const availability = await LanguageModel.availability();
      logDebug(`LanguageModel.availability(): "${availability}"`);
      if (availability !== "no") {
        aiModel = {
          create: (options) => LanguageModel.create(options),
          capabilities: () => LanguageModel.capabilities ? LanguageModel.capabilities() : Promise.resolve({ available: availability }),
          availability: () => Promise.resolve(availability)
        };
        return true;
      }
    } catch (err) {
      logDebug(`Error checking global LanguageModel: ${err.message}`);
    }
  }

  if (target) {
    logDebug(`Keys on target: [${Object.keys(target).join(", ")}]`);
    if (target.languageModel) {
      aiModel = target.languageModel;
      logDebug("Selected: target.languageModel");
    } else if (target.assistant) {
      aiModel = target.assistant;
      logDebug("Selected: target.assistant");
    }
  }

  if (!aiModel) {
    logDebug("Error: No AI model namespace found. Checked (ai, window.ai, chrome.ai, chrome.aiOriginTrial, LanguageModel, chrome.aiLanguageModel)");
    return false;
  }

  try {
    if (typeof aiModel.capabilities === "function") {
      logDebug("Calling capabilities()...");
      const capabilities = await aiModel.capabilities();
      logDebug(`capabilities.available: "${capabilities.available}"`);
      return capabilities.available !== "no";
    } else if (typeof aiModel.canCreate === "function") {
      logDebug("Calling canCreate()...");
      const availability = await aiModel.canCreate();
      logDebug(`canCreate: "${availability}"`);
      return availability !== "no";
    } else if (typeof aiModel.availability === "function") {
      logDebug("Calling availability()...");
      const availability = await aiModel.availability();
      logDebug(`availability: "${availability}"`);
      return availability !== "no";
    } else {
      logDebug("Warning: No standard capability function found. Attempting direct creation...");
      const testSession = await aiModel.create();
      testSession.destroy();
      logDebug("Direct session creation test succeeded!");
      return true;
    }
  } catch (err) {
    logDebug(`Exception checking capabilities: ${err.message}`);
    console.error("Capability check threw exception:", err);
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

// Set up copying text contents
function setupCopyButtons() {
  document.querySelectorAll(".btn-copy").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        navigator.clipboard.writeText(targetEl.innerText)
          .then(() => {
            const originalText = btn.innerText;
            btn.innerText = "Copied!";
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

// UI State Toggles during loading/processing
function showLoading(text) {
  loadingText.innerText = text;
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

// Core Analysis Handler
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
  showLoading("Processing pasted text...");
  try {
    await processText(content);
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    hideLoading();
  }
}

// Scrape page text via scripting API
async function getActiveTabContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("No active tab found.");

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
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

// Text Processing using Prompt API
async function processText(text) {
  // Truncate to avoid Gemini Nano token capacity constraints (~4k-8k tokens max)
  const maxLength = 12000;
  analyzedText = text.length > maxLength 
    ? text.substring(0, maxLength) + "\n\n[Content truncated for analysis limitations]"
    : text;

  // Reset states
  chatSession = null;
  chatMessages.innerHTML = "";

  showLoading("Analyzing: Generating Summary...");
  try {
    const summarySession = await aiModel.create({
      systemPrompt: "You are a legal assistant. Provide a very short, high-level summary (3-4 sentences max) of the provided terms and conditions text. Do not use legal jargon. Focus on what this service is and user consent."
    });
    currentSummary = await summarySession.prompt(analyzedText);
    summaryTextContainer.innerText = currentSummary;
    summarySession.destroy();
  } catch (err) {
    console.error("Summary failed:", err);
    currentSummary = "Error generating summary with Gemini Nano: " + err.message;
    summaryTextContainer.innerText = currentSummary;
  }

  showLoading("Analyzing: Extracting Risks...");
  try {
    const risksSession = await aiModel.create({
      systemPrompt: "You are a legal assistant. Based on the terms and conditions text, list the top 7 most offensive or risky clauses. Format the output strictly as a markdown bulleted list, where each bullet contains a very very brief one-liner explanation of the clause. Do not use legal jargon."
    });
    currentRisks = await risksSession.prompt(analyzedText);
    
    // Parse simple markdown list to HTML format
    risksListContainer.innerHTML = formatMarkdownList(currentRisks);
    risksSession.destroy();
  } catch (err) {
    console.error("Risks extraction failed:", err);
    currentRisks = "Error extracting risk clauses with Gemini Nano: " + err.message;
    risksListContainer.innerText = currentRisks;
  }

  // Enable navigation tabs
  navSummary.removeAttribute("disabled");
  navRisks.removeAttribute("disabled");
  navChat.removeAttribute("disabled");

  // Automatically show summary tab
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

  // Append user message
  appendMessage("user", query);
  chatInput.value = "";

  const responsePlaceholder = appendMessage("assistant", "Thinking...");

  try {
    if (!chatSession) {
      showLoading("Initializing chat context...");
      try {
        chatSession = await aiModel.create({
          systemPrompt: `You are an AI legal assistant. You are chatting about this Terms and Conditions document. You must ONLY answer questions directly related to this document. If the question is irrelevant, refuse to answer politely. Here is the context of the terms: ${analyzedText}`
        });
      } finally {
        hideLoading();
      }
    }

    const reply = await chatSession.prompt(query);
    responsePlaceholder.innerText = reply;
  } catch (err) {
    console.error("Chat prompting error:", err);
    responsePlaceholder.innerText = "Sorry, I encountered an error answering your question. It could be due to model token limits or internal browser settings.";
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

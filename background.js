let lastFormattedText = "";

// Listen for the message from content.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STORE_FORMATTED_TEXT") {
    lastFormattedText = message.formattedText;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveText",
    title: "Save selection to Snippets",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "saveText") return;

  const newEntry = {
    id: Date.now(),
    content: lastFormattedText || info.selectionText,
    url: tab.url,
    title: tab.title,
    date: new Date().toLocaleString()
  };

  chrome.storage.local.get({ clips: [] }, (data) => {
    const clips = [newEntry, ...data.clips];
    chrome.storage.local.set({ clips }, () => {

      // ✅ Tell content script to clear selection
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: "CLEAR_SELECTION"
        });
      }
    });
  });
});
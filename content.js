document.addEventListener("contextmenu", () => {
    // ⛔ Guard: chrome.runtime may not exist on restricted pages
    if (
        typeof chrome === "undefined" ||
        !chrome.runtime ||
        !chrome.runtime.sendMessage
    ) {
        return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const container = document.createElement("div");
    for (let i = 0; i < selection.rangeCount; i++) {
        container.appendChild(selection.getRangeAt(i).cloneContents());
    }

    const formattedText = container.innerText;

    chrome.runtime.sendMessage({
        type: "STORE_FORMATTED_TEXT",
        formattedText
    });
});


chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "CLEAR_SELECTION") {
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
        }
    }
});

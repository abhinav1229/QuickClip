const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");

document.getElementById("export-btn").onclick = async () => {
    chrome.storage.local.get({ clips: [] }, ({ clips }) => {
        const payload = {
            app: "QuickClip",
            version: 1,
            exportedAt: new Date().toISOString(),
            clips
        };

        const blob = new Blob(
            [JSON.stringify(payload, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `quickclip-backup-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    });
};


/* DELETE---ALL */


const deleteAllBtn = document.getElementById("delete-all-btn");

deleteAllBtn.onclick = async () => {
    const ok = confirm(
        "This will permanently delete ALL notes.\n\nThis action cannot be undone.\n\nContinue?"
    );
    if (!ok) return;

    chrome.storage.local.get(
        { clips: [], masterHash: null },
        async ({ clips, masterHash }) => {

            // 🔒 If ANY locked notes exist → require password
            const hasLocked = clips.some(c => c.locked);

            if (hasLocked) {
                const entered = await askPasswordMasked();
                if (!entered) return;

                const enteredHash = await sha256(entered);
                if (enteredHash !== masterHash) {
                    alert("Incorrect password");
                    return;
                }
            }

            chrome.storage.local.set({ clips: [] }, () => {
                displayClips();
            });
        }
    );
};


/* ================== */


const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");

importBtn.onclick = () => importFile.click();



importFile.onchange = async () => {
    const file = importFile.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        // 🔎 Validate structure
        if (
            data.app !== "QuickClip" ||
            data.version !== 1 ||
            !Array.isArray(data.clips)
        ) {
            alert("Invalid QuickClip backup file");
            return;
        }

        chrome.storage.local.get({ clips: [] }, ({ clips }) => {

            const existingIds = new Set(clips.map(c => c.id));

            const imported = data.clips.map(c => ({
                ...c,
                id: existingIds.has(c.id) ? Date.now() + Math.random() : c.id
            }));

            const merged = [...imported, ...clips];

            chrome.storage.local.set({ clips: merged }, () => {
                displayClips();
                alert(`Imported ${imported.length} notes`);
            });
        });

    } catch (err) {
        alert("Failed to import file");
    } finally {
        importFile.value = ""; // reset picker
    }
};


/* ============================
   🔐 CRYPTO HELPERS
============================ */

async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function generateRecoveryKey() {
    return `QC-${crypto.randomUUID().toUpperCase()}`;
}

/* ============================
   🔑 INITIAL SECURITY SETUP
============================ */

async function ensureSecuritySetup() {
    chrome.storage.local.get(
        { masterHash: null, recoveryHash: null },
        async (data) => {
            if (data.masterHash && data.recoveryHash) return;

            const master = await askPasswordMasked();
            if (!/^\d{4}$/.test(master)) {
                alert("Password must be exactly 4 digits");
                return;
            }

            const recoveryKey = generateRecoveryKey();
            await showRecoveryKeySimple(recoveryKey);

            const masterHash = await sha256(master);
            const recoveryHash = await sha256(recoveryKey);

            chrome.storage.local.set({ masterHash, recoveryHash });
        }
    );
}


async function showRecoveryKeySimple(recoveryKey) {
    try {
        await navigator.clipboard.writeText(recoveryKey);
    } catch (e) {
        // Clipboard may fail in rare cases, still continue
    }

    alert(
        "⚠️ SAVE THIS RECOVERY KEY ⚠️\n\n" +
        recoveryKey +
        "\n\n(The key has already been copied to your clipboard)\n" +
        "Paste it somewhere safe now.\n\n" +
        "This key will NOT be shown again."
    );
}


ensureSecuritySetup();

/* ============================
    PASSWORD VERIFICATION
============================ */

async function verifyPassword(input, expectedHash) {
    const hash = await sha256(input);
    return hash === expectedHash;
}

/* ============================
   🧠 UI HELPERS
============================ */

function askLockType() {
    const choice = prompt(
        "Lock note using:\n" +
        "1. Master Password\n" +
        "2. New Password (this note only)"
    );
    return choice === "1" || choice === "2" ? choice : null;
}

async function askForPinMasked() {
    const pin = await askPasswordMasked();
    if (!/^\d{4}$/.test(pin)) {
        alert("Password must be exactly 4 digits");
        return null;
    }
    return pin;
}

/* ============================
   🖼️ DISPLAY CLIPS
============================ */

function displayClips(query = "") {
    chrome.storage.local.get({ clips: [] }, (data) => {
        listEl.innerHTML = "";

        const filtered = data.clips.filter(c =>
            c.content.toLowerCase().includes(query.toLowerCase()) ||
            c.title.toLowerCase().includes(query.toLowerCase())
        );

        filtered.forEach(clip => {
            const words = clip.content.trim().split(/\s+/);
            const isLong = words.length > 70;

            const preview = clip.locked
                ? " Locked note"
                : isLong
                    ? words.slice(0, 70).join(" ") + "..."
                    : clip.content;

            const div = document.createElement("div");
            div.className = "clip";
            div.dataset.id = clip.id;

            div.innerHTML = `
        <a href="${clip.url}" target="_blank" class="site-link">
          ${clip.title.substring(0, 60)}
        </a>
        <div class="content-preview">${preview}</div>
        <div class="btn-row">
            <button 
                class="copy-btn" 
                ${clip.locked ? "disabled" : ""}
                data-content="${encodeURIComponent(clip.content)}">
                ${clip.locked ? "Locked" : "Copy"}
            </button>


            <button class="more-btn">Options</button>
            </div>

            <div class="options-menu" style="display:none;">
            <button class="edit-btn">Edit</button>
            ${isLong ? `<button class="view-btn">View</button>` : ""}
            <button class="lock-btn">
                ${clip.locked ? "Unlock" : "Lock"}
            </button>
            <button class="delete-btn">Delete</button>
        </div>


      `;
            listEl.appendChild(div);
        });
    });
}

displayClips();

/* ============================
   🖱️ CLICK HANDLER
============================ */

listEl.addEventListener("click", async (e) => {
    const clipDiv = e.target.closest(".clip");
    if (!clipDiv) return;

    const id = parseInt(clipDiv.dataset.id, 10);

    chrome.storage.local.get(
        { clips: [], masterHash: null },
        async (data) => {
            const clip = data.clips.find(c => c.id === id);
            if (!clip) return;


            // OPTIONS MENU TOGGLE
            if (e.target.classList.contains("more-btn")) {
                const clipDiv = e.target.closest(".clip");
                const menu = clipDiv.querySelector(".options-menu");

                // 👇 Check current state FIRST
                const isOpen = menu.style.display === "flex";

                // Close all menus
                document.querySelectorAll(".options-menu").forEach(m => {
                    m.style.display = "none";
                });

                // Toggle ONLY if it was closed before
                if (!isOpen) {
                    menu.style.display = "flex";
                }

                return;
            }



            /* =====================
               COPY (NO LOCK CHECK)
            ===================== */
            if (e.target.classList.contains("copy-btn")) {
                if (clip.locked) return; // 🔐 HARD BLOCK

                navigator.clipboard.writeText(
                    decodeURIComponent(e.target.dataset.content)
                );
                return;
            }


            /* =====================
               DELETE (NO LOCK CHECK)
            ===================== */
            if (e.target.classList.contains("delete-btn")) {

                // 🔒 Locked → require password
                if (clip.locked) {
                    const entered = await askPasswordMasked();
                    if (!entered) return;

                    const enteredHash = await sha256(entered);
                    const expected = clip.noteHash || data.masterHash;

                    if (enteredHash !== expected) {
                        alert("Incorrect password");
                        return;
                    }
                }

                if (!confirm("Delete this note?")) return;

                chrome.storage.local.set(
                    { clips: data.clips.filter(c => c.id !== id) },
                    displayClips
                );

                const menu = clipDiv.querySelector(".options-menu");
                if (menu) menu.style.display = "none";
                return;
            }

            if (e.target.classList.contains("edit-btn")) {
                chrome.tabs.create({ url: `dashboard.html?id=${id}` });

                // ✅ Step 4: close menu
                const menu = clipDiv.querySelector(".options-menu");
                if (menu) menu.style.display = "none";
                return;
            }

            /* =====================
               VIEW (LOCK CHECK)
            ===================== */
            if (e.target.classList.contains("view-btn")) {
                if (clip.locked) {
                    const entered = await askPasswordMasked();
                    if (!entered) return;

                    const enteredHash = await sha256(entered);
                    const expected = clip.noteHash || data.masterHash;

                    if (enteredHash !== expected) {
                        alert("Incorrect password");
                        return;
                    }
                }

                chrome.tabs.create({ url: `dashboard.html?id=${id}` });

                // ✅ Step 4: close menu
                const menu = clipDiv.querySelector(".options-menu");
                if (menu) menu.style.display = "none";

                return;
            }

            /* =====================
               LOCK / UNLOCK (LOCK CHECK)
            ===================== */
            if (e.target.classList.contains("lock-btn")) {
                //  UNLOCK
                if (clip.locked) {
                    const entered = await askPasswordMasked();
                    if (!entered) return;

                    const enteredHash = await sha256(entered);
                    const expected = clip.noteHash || data.masterHash;

                    if (enteredHash !== expected) {
                        alert("Incorrect password");
                        return;
                    }

                    const updated = data.clips.map(c =>
                        c.id === id
                            ? { ...c, locked: false, noteHash: null }
                            : c
                    );

                    chrome.storage.local.set({ clips: updated }, displayClips);
                    return;
                }

                //  LOCK
                const type = askLockType();
                if (!type) return;

                let noteHash = null;

                if (type === "1") {
                    const entered = await askPasswordMasked();
                    if (!entered) return;

                    const ok = await verifyPassword(entered, data.masterHash);
                    if (!ok) {
                        alert("Incorrect master password");
                        return;
                    }
                }

                if (type === "2") {
                    const pin = await askForPinMasked();
                    if (!pin) return;
                    noteHash = await sha256(pin);
                }

                const updated = data.clips.map(c =>
                    c.id === id
                        ? { ...c, locked: true, noteHash }
                        : c
                );

                chrome.storage.local.set({ clips: updated }, displayClips);
                return;
            }

            // ❌ Clicking text / empty space → do NOTHING
        }
    );
});

function refreshUI() {
    displayClips(searchEl.value || "");
}


document.addEventListener("click", (e) => {
    if (!e.target.closest(".clip")) {
        document.querySelectorAll(".options-menu").forEach(menu => {
            menu.style.display = "none";
        });
    }
});


/* ============================
   🔎 SEARCH
============================ */

searchEl.addEventListener("input", e => displayClips(e.target.value));


function askPasswordMasked() {
    return new Promise(resolve => {
        const modal = document.getElementById("password-modal");
        const input = document.getElementById("password-input");
        const ok = document.getElementById("password-ok");
        const cancel = document.getElementById("password-cancel");

        modal.style.display = "flex";
        input.value = "";
        input.focus();

        const close = (value) => {
            modal.style.display = "none";
            resolve(value);
        };

        ok.onclick = () => close(input.value || null);
        cancel.onclick = () => close(null);

        input.onkeydown = (e) => {
            if (e.key === "Enter") close(input.value || null);
            if (e.key === "Escape") close(null);
        };
    });
}


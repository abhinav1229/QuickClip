/* ============================
   🔐 CRYPTO (same as popup.js)
============================ */

async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

/* ============================
   📄 LOAD NOTE
============================ */

const params = new URLSearchParams(window.location.search);
const clipId = parseInt(params.get("id"), 10);

chrome.storage.local.get(
    { clips: [], masterHash: null },
    async (data) => {
        const clip = data.clips.find(c => c.id === clipId);

        if (!clip) {
            document.body.innerHTML = "<h2>Note not found</h2>";
            return;
        }

        /* =====================
            LOCK CHECK
        ===================== */
        if (clip.locked) {
            const entered = prompt("Enter password");
            if (!entered) {
                document.body.innerHTML = "<h2> This note is locked</h2>";
                return;
            }

            const enteredHash = await sha256(entered);
            const expectedHash = clip.noteHash || data.masterHash;

            if (enteredHash !== expectedHash) {
                document.body.innerHTML = "<h2> Incorrect password</h2>";
                return;
            }
        }

        /* =====================
           ✅ RENDER NOTE
        ===================== */
        renderClip(clip);
    }
);

/* ============================
   🖼️ RENDER
============================ */

function renderClip(clip) {
  document.getElementById("title").innerText = clip.title;
  document.getElementById("link").innerText = clip.url;
  document.getElementById("link").href = clip.url;
  document.getElementById("date").innerText = clip.date;

  const textEl = document.getElementById("text");
  const editBtn = document.getElementById("edit-btn");
  const saveBtn = document.getElementById("save-btn");

  textEl.value = clip.content;
  textEl.setAttribute("readonly", true);

  editBtn.onclick = () => {
    textEl.removeAttribute("readonly");
    textEl.focus();
    editBtn.style.display = "none";
    saveBtn.style.display = "inline-block";
  };

  saveBtn.onclick = () => {
    const updatedContent = textEl.value;

    chrome.storage.local.get({ clips: [] }, (data) => {
      const updated = data.clips.map(c =>
        c.id === clip.id
          ? { ...c, content: updatedContent }
          : c
      );

      chrome.storage.local.set({ clips: updated }, () => {
        textEl.setAttribute("readonly", true);
        editBtn.style.display = "inline-block";
        saveBtn.style.display = "none";
      });
    });
  };
}



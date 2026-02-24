const contentEl = document.getElementById("content");
const tokenEl = document.getElementById("token");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");

fetch("/api/content")
  .then((res) => res.json())
  .then((data) => {
    contentEl.value = JSON.stringify(data, null, 2);
  })
  .catch(() => {
    statusEl.textContent = "Unable to load content.";
  });

saveBtn.addEventListener("click", async () => {
  statusEl.textContent = "Saving...";

  try {
    const content = JSON.parse(contentEl.value);
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenEl.value, content })
    });

    if (!res.ok) {
      const data = await res.json();
      statusEl.textContent = data.error || "Save failed.";
      return;
    }

    statusEl.textContent = "Saved.";
  } catch (err) {
    statusEl.textContent = "Invalid JSON.";
  }
});

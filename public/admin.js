const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const passcodeInput = document.getElementById("passcode");
const logoutButton = document.getElementById("logoutButton");
const paintingForm = document.getElementById("paintingForm");
const paintingMessage = document.getElementById("paintingMessage");
const listMessage = document.getElementById("listMessage");
const paintingList = document.getElementById("paintingList");
const paintingImage = document.getElementById("paintingImage");
const imagePreview = document.getElementById("imagePreview");
const previewImage = document.getElementById("previewImage");
const previewCaption = document.getElementById("previewCaption");
const imageHint = document.getElementById("imageHint");
const searchInput = document.getElementById("searchInput");
let adminPasscode = "";
let paintings = [];
let editingId = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function setMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
}

function priceLabel(price) {
  return `₹${Number(price).toLocaleString("en-IN")}`;
}

async function responseData(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const attempt = passcodeInput.value;
  loginButton.disabled = true;
  loginButton.textContent = "Signing in…";
  setMessage(loginMessage, "");
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: attempt })
    });
    await responseData(response);
    adminPasscode = attempt;
    passcodeInput.value = "";
    loginPanel.hidden = true;
    dashboard.hidden = false;
    await loadPaintings();
  } catch (error) {
    setMessage(loginMessage, error.message || "Could not connect to the server.");
    console.error("Admin sign-in failed:", error);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Sign in";
  }
});

logoutButton.addEventListener("click", () => {
  adminPasscode = "";
  paintings = [];
  resetForm();
  dashboard.hidden = true;
  loginPanel.hidden = false;
  setMessage(loginMessage, "");
  passcodeInput.focus();
});

async function loadPaintings() {
  setMessage(listMessage, "");
  paintingList.innerHTML = '<div class="list-empty">Loading your paintings…</div>';
  try {
    const response = await fetch("/api/paintings");
    paintings = await responseData(response);
    if (!Array.isArray(paintings)) throw new Error("The gallery returned an invalid response.");
    renderPaintings();
    renderStats();
  } catch (error) {
    paintingList.innerHTML = '<div class="list-empty">Paintings could not be loaded.</div>';
    setMessage(listMessage, error.message || "Could not connect to the server.");
    console.error("Unable to load admin gallery:", error);
  }
}

function renderStats() {
  document.getElementById("paintingCount").textContent = paintings.length;
  const average = paintings.length
    ? paintings.reduce((total, painting) => total + Number(painting.price || 0), 0) / paintings.length
    : 0;
  document.getElementById("averagePrice").textContent = priceLabel(Math.round(average));
}

function renderPaintings() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visiblePaintings = paintings.filter(painting =>
    `${painting.title} ${painting.desc || ""} ${painting.size || ""}`.toLocaleLowerCase().includes(query)
  );
  if (!visiblePaintings.length) {
    paintingList.innerHTML = `<div class="list-empty">${query ? "No paintings match your search." : "No paintings yet. Add your first piece using the form."}</div>`;
    return;
  }
  paintingList.innerHTML = visiblePaintings.map((painting, index) => `
    <article class="painting-row" style="--row-index:${index}">
      <img src="${escapeHtml(painting.image)}" alt="${escapeHtml(painting.title)}">
      <div class="painting-info">
        <strong>${escapeHtml(painting.title)}</strong>
        <span>${priceLabel(painting.price)}${painting.size ? ` · ${escapeHtml(painting.size)}` : ""}</span>
      </div>
      <div class="row-actions">
        <button type="button" data-action="edit" data-id="${escapeHtml(painting.id)}">Edit</button>
        <button class="delete-button" type="button" data-action="delete" data-id="${escapeHtml(painting.id)}">Delete</button>
      </div>
    </article>`).join("");
}

searchInput.addEventListener("input", renderPaintings);

paintingList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const painting = paintings.find(item => item.id === button.dataset.id);
  if (!painting) return;
  if (button.dataset.action === "edit") {
    startEditing(painting);
    return;
  }
  if (!window.confirm(`Delete "${painting.title}" from the public gallery?`)) return;
  button.disabled = true;
  setMessage(listMessage, "");
  try {
    const response = await fetch(`/api/paintings/${encodeURIComponent(painting.id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: adminPasscode })
    });
    await responseData(response);
    paintings = paintings.filter(item => item.id !== painting.id);
    renderPaintings();
    renderStats();
    setMessage(listMessage, "Painting removed from the public gallery.", true);
    if (editingId === painting.id) resetForm();
  } catch (error) {
    button.disabled = false;
    setMessage(listMessage, error.message || "Could not delete this painting.");
    console.error("Unable to delete painting:", error);
  }
});

function startEditing(painting) {
  editingId = painting.id;
  document.getElementById("formEyebrow").textContent = "EDIT LISTING";
  document.getElementById("formTitle").textContent = "Update painting";
  document.getElementById("saveButton").textContent = "Save changes";
  document.getElementById("cancelEditButton").hidden = false;
  document.getElementById("imageRequired").hidden = true;
  paintingImage.required = false;
  imageHint.textContent = "Choose a new photo only if you want to replace the current one.";
  document.getElementById("paintingTitle").value = painting.title;
  document.getElementById("paintingDescription").value = painting.desc || "";
  document.getElementById("paintingPrice").value = painting.price;
  document.getElementById("paintingSize").value = painting.size || "";
  previewImage.src = painting.image;
  previewCaption.textContent = "Current photo (kept unless you choose a replacement)";
  imagePreview.hidden = false;
  setMessage(paintingMessage, "");
  paintingForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("cancelEditButton").addEventListener("click", resetForm);

function resetForm() {
  paintingForm.reset();
  editingId = null;
  paintingImage.required = true;
  document.getElementById("formEyebrow").textContent = "NEW LISTING";
  document.getElementById("formTitle").textContent = "Add a painting";
  document.getElementById("saveButton").textContent = "Publish painting";
  document.getElementById("cancelEditButton").hidden = true;
  document.getElementById("imageRequired").hidden = false;
  imageHint.textContent = "Choose a clear JPG, PNG, WebP, or GIF image (up to 8 MB).";
  imagePreview.hidden = true;
  previewImage.removeAttribute("src");
  setMessage(paintingMessage, "");
}

paintingImage.addEventListener("change", () => {
  const file = paintingImage.files[0];
  if (!file) {
    if (!editingId) imagePreview.hidden = true;
    return;
  }
  if (!file.type.startsWith("image/")) {
    paintingImage.value = "";
    setMessage(paintingMessage, "Choose a valid image file.");
    return;
  }
  previewImage.src = URL.createObjectURL(file);
  previewCaption.textContent = file.name;
  imagePreview.hidden = false;
  setMessage(paintingMessage, "");
});

paintingForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submitButton = document.getElementById("saveButton");
  const formData = new FormData(paintingForm);
  formData.delete("image");
  formData.append("passcode", adminPasscode);
  const imageFile = paintingImage.files[0];
  if (imageFile) formData.append("image", imageFile);

  submitButton.disabled = true;
  setMessage(paintingMessage, "");
  try {
    const editing = Boolean(editingId);
    const url = editing ? `/api/paintings/${encodeURIComponent(editingId)}` : "/api/paintings";
    const response = await fetch(url, {
      method: editing ? "PUT" : "POST",
      body: formData
    });
    const savedPainting = await responseData(response);
    if (editing) {
      paintings = paintings.map(painting => painting.id === savedPainting.id ? savedPainting : painting);
    } else {
      paintings.push(savedPainting);
    }
    renderPaintings();
    renderStats();
    resetForm();
    setMessage(paintingMessage, editing ? "Painting updated and live on your website." : "Painting published to your public gallery.", true);
  } catch (error) {
    setMessage(paintingMessage, error.message || "Could not save this painting.");
    console.error("Unable to save painting:", error);
  } finally {
    submitButton.disabled = false;
  }
});

/* =========================================================
   Front-end only settings.
   The admin passcode itself lives in server.js — change it there.
   ========================================================= */
const WHATSAPP_NUMBER = "919636165557"; // WhatsApp number, country code, no + or spaces
const PRICE_BUCKETS = [
  { id: "b1", label: "Under ₹1,500",        min: 0,    max: 1500 },
  { id: "b2", label: "₹1,500 – ₹3,500",     min: 1500, max: 3500 },
  { id: "b3", label: "₹3,500 – ₹7,000",     min: 3500, max: 7000 },
  { id: "b4", label: "₹7,000 and above",    min: 7000, max: Infinity },
];

/* ---------- Decorative mandala SVGs (logo + hero, not product photos) ---------- */
function buildMandala(svgEl, opts){
  const { size=400, rings=5, petalsPerRing=12, stroke="#D9A73B", stroke2="#7E2A38", bg=null } = opts;
  const c = size/2;
  svgEl.setAttribute("viewBox", `0 0 ${size} ${size}`);
  let html = "";
  if(bg) html += `<circle cx="${c}" cy="${c}" r="${c}" fill="${bg}"/>`;
  for(let r=1;r<=rings;r++){
    const radius = (c-10) * (r/rings);
    const petals = petalsPerRing + r*2;
    const col = r % 2 === 0 ? stroke : stroke2;
    for(let i=0;i<petals;i++){
      const angle = (360/petals)*i;
      const petalLen = radius/rings*1.5;
      html += `<g transform="rotate(${angle} ${c} ${c})">
        <path d="M ${c} ${c-radius} q ${petalLen*0.35} ${petalLen*0.5} 0 ${petalLen}" 
              fill="none" stroke="${col}" stroke-width="1.4" opacity="0.85"/>
      </g>`;
    }
    html += `<circle cx="${c}" cy="${c}" r="${radius}" fill="none" stroke="${col}" stroke-width="0.6" opacity="0.4"/>`;
  }
  html += `<circle cx="${c}" cy="${c}" r="10" fill="${stroke}"/>`;
  svgEl.innerHTML = html;
}
const brandMandala = document.getElementById("brandMandala");
const heroMandala = document.getElementById("heroMandala");
const aboutMandala = document.getElementById("aboutMandala");

if (brandMandala) buildMandala(brandMandala, {size:60, rings:3, petalsPerRing:8});
if (heroMandala) buildMandala(heroMandala, {size:400, rings:6, petalsPerRing:10});
if (aboutMandala) buildMandala(aboutMandala, {size:400, rings:5, petalsPerRing:12, bg:"none"});

/* ---------- Nav toggle ---------- */
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
if (navToggle && navLinks) {
  navToggle.addEventListener("click", ()=> navLinks.classList.toggle("open"));
  navLinks.querySelectorAll("a").forEach(a=>a.addEventListener("click", ()=>navLinks.classList.remove("open")));
}

/* ---------- State ---------- */
let paintings = [];
let activeFilter = "all";
let isAdmin = false;
let adminPasscode = null; // held in memory only, never stored on disk in the browser

function bucketFor(price){
  return PRICE_BUCKETS.find(b => price >= b.min && price < b.max) || PRICE_BUCKETS[PRICE_BUCKETS.length-1];
}

/* ---------- Talking to the backend ---------- */
async function fetchPaintings(){
  const res = await fetch('/api/paintings');
  if(!res.ok) throw new Error('Could not load paintings from the server.');
  return res.json();
}

async function loadAndRender(){
  try{
    paintings = await fetchPaintings();
    renderFilters();
    renderGallery();
  }catch(e){
    document.getElementById("galleryBlocks").innerHTML =
      `<div class="empty-state">Could not reach the server. Make sure it's running (see README), then reload this page.</div>`;
    console.error(e);
  }
}

/* ---------- Filters ---------- */
function renderFilters(){
  const wrap = document.getElementById("filters");
  if (!wrap) return;
  const all = [{id:"all", label:"All"}, ...PRICE_BUCKETS];
  wrap.innerHTML = all.map(b =>
    `<button class="filter-btn ${activeFilter===b.id?'active':''}" data-f="${b.id}">${b.label}</button>`
  ).join("");
  wrap.querySelectorAll(".filter-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      activeFilter = btn.dataset.f;
      renderFilters();
      renderGallery();
    });
  });
}

function waLink(p){
  const msg = encodeURIComponent(`Hi! I'm interested in the "${p.title}" painting (₹${p.price}).`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

function cardHTML(p){
  return `
  <div class="card">
    <div class="card-img"><img src="${p.image}" alt="${p.title}" loading="lazy"></div>
    <div class="card-body">
      <div class="card-footer">
        <span class="card-title-inline">${p.title} — <span class="card-price">₹${Number(p.price).toLocaleString('en-IN')}</span></span>
        <a class="card-buy" href="${waLink(p)}" target="_blank">Ask to buy</a>
      </div>
      ${isAdmin ? `<button class="card-admin-del" data-id="${p.id}">Remove this</button>` : ""}
    </div>
  </div>`;
}

function renderGallery(){
  const container = document.getElementById("galleryBlocks");
  if (!container) return;
  const buckets = activeFilter === "all" ? PRICE_BUCKETS : PRICE_BUCKETS.filter(b=>b.id===activeFilter);
  let html = "";
  buckets.forEach(b=>{
    const items = paintings.filter(p => bucketFor(Number(p.price)).id === b.id)
                            .sort((a,z)=>z.createdAt-a.createdAt);
    html += `<div class="price-block">
      <div class="price-block-head">
        <h3>${b.label}</h3>
        <span>${items.length} painting${items.length===1?'':'s'}</span>
      </div>
      ${items.length ? `<div class="grid">${items.map(cardHTML).join("")}</div>`
                      : `<div class="empty-state">No paintings in this section yet.</div>`}
    </div>`;
  });
  container.innerHTML = html;

  if(isAdmin){
    container.querySelectorAll(".card-admin-del").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        if(!confirm("Remove this painting from the gallery?")) return;
        try{
          const res = await fetch(`/api/paintings/${btn.dataset.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode: adminPasscode })
          });
          if(!res.ok){
            const data = await res.json().catch(()=>({}));
            alert(data.error || 'Could not remove this painting.');
            return;
          }
          paintings = paintings.filter(p => p.id !== btn.dataset.id);
          renderGallery();
        }catch(e){
          alert('Could not reach the server.');
          console.error(e);
        }
      });
    });
  }
}

/* ---------- Admin unlock ---------- */
const gate = document.getElementById("gate");
const uploadForm = document.getElementById("uploadForm");
const passInput = document.getElementById("passInput");
const gateBtn = document.getElementById("gateBtn");
const lockBtn = document.getElementById("lockBtn");

if (gateBtn && passInput) {
  gateBtn.addEventListener("click", async ()=>{
    const attempt = passInput.value;
    gateBtn.disabled = true;
    gateBtn.textContent = "Checking…";
    try{
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: attempt })
      });
      if(res.ok){
        isAdmin = true;
        adminPasscode = attempt;
        if (gate) gate.style.display = "none";
        if (uploadForm) uploadForm.style.display = "flex";
        renderGallery();
      }else{
        passInput.style.borderColor = "var(--maroon)";
        passInput.value = "";
        passInput.placeholder = "Wrong passcode, try again";
      }
    }catch(e){
      alert('Could not reach the server. Is it running?');
      console.error(e);
    }finally{
      gateBtn.disabled = false;
      gateBtn.textContent = "Unlock";
    }
  });
  passInput.addEventListener("keydown", e=>{ if(e.key==="Enter") gateBtn.click(); });
}

if (lockBtn && gate && uploadForm && passInput) {
  lockBtn.addEventListener("click", async ()=>{
    isAdmin = false;
    adminPasscode = null;
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout failed', e);
    }
    gate.style.display = "block";
    uploadForm.style.display = "none";
    passInput.value = "";
    renderGallery();
  });
}

async function restoreAdminSession() {
  // Require a fresh passcode each time the admin page loads.
  // We intentionally do not restore the session automatically so the
  // admin page does not unlock itself from a saved cookie.
  if (!gateBtn || !passInput || !uploadForm || !gate) return;
  gate.style.display = "block";
  uploadForm.style.display = "none";
  isAdmin = false;
  adminPasscode = null;
  passInput.value = "";
  passInput.placeholder = "passcode";
}

/* ---------- Photo picker + client-side resize (keeps uploads light) ---------- */
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const dropPreview = document.getElementById("dropPreview");
const dropText = document.getElementById("dropText");
let pendingBlob = null;

if (dropZone && fileInput) {
  dropZone.addEventListener("click", ()=> fileInput.click());
  fileInput.addEventListener("change", handleFile);
}

function handleFile(){
  const file = fileInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    const img = new Image();
    img.onload = ()=>{
      const maxDim = 1400;
      let { width, height } = img;
      if(width > height && width > maxDim){ height *= maxDim/width; width = maxDim; }
      else if(height > maxDim){ width *= maxDim/height; height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob)=>{
        pendingBlob = blob;
        dropPreview.src = URL.createObjectURL(blob);
        dropPreview.style.display = "block";
        dropText.style.display = "none";
        dropZone.classList.add("has-img");
      }, "image/jpeg", 0.87);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ---------- Submit new painting ---------- */
const formMsg = document.getElementById("formMsg");
if (uploadForm) {
  uploadForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const title = document.getElementById("fTitle").value.trim();
    const desc = document.getElementById("fDesc").value.trim();
    const price = document.getElementById("fPrice").value;
    const size = document.getElementById("fSize").value.trim();

    if(!title || !price || !pendingBlob){
      formMsg.textContent = "Please add a photo, title, and price.";
      formMsg.className = "form-msg err";
      return;
    }

    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Adding…";

    try{
      const fd = new FormData();
      fd.append("title", title);
      fd.append("desc", desc);
      fd.append("price", price);
      fd.append("size", size);
      fd.append("passcode", adminPasscode);
      fd.append("image", pendingBlob, "painting.jpg");

      const res = await fetch('/api/paintings', { method: 'POST', body: fd });
      const data = await res.json();

      if(!res.ok){
        formMsg.textContent = data.error || "Could not add this painting.";
        formMsg.className = "form-msg err";
        return;
      }

      paintings.push(data);
      formMsg.textContent = "Painting added to the gallery ✓";
      formMsg.className = "form-msg ok";
      uploadForm.reset();
      pendingBlob = null;
      if (dropPreview) dropPreview.style.display = "none";
      if (dropText) dropText.style.display = "block";
      if (dropZone) dropZone.classList.remove("has-img");
      renderGallery();
    }catch(err){
      formMsg.textContent = "Could not reach the server.";
      formMsg.className = "form-msg err";
      console.error(err);
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = "Add to gallery";
    }
  });
}

/* ---------- Init ---------- */
if (document.getElementById("galleryBlocks") || document.getElementById("filters")) {
  loadAndRender();
}

if (document.getElementById("uploadForm") && document.getElementById("gateBtn")) {
  restoreAdminSession();
}

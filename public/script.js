const WHATSAPP_NUMBER = "919636165557";
const PRICE_BUCKETS = [
  { id: "b1", label: "Under ₹1,500", min: 0, max: 1500 },
  { id: "b2", label: "₹1,500 – ₹3,500", min: 1500, max: 3500 },
  { id: "b3", label: "₹3,500 – ₹7,000", min: 3500, max: 7000 },
  { id: "b4", label: "₹7,000 and above", min: 7000, max: Infinity }
];

function buildMandala(svg) {
  const size = 60;
  const center = size / 2;
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  let markup = "";
  for (let ring = 1; ring <= 3; ring += 1) {
    const radius = 25 * ring / 3;
    const petals = 8 + ring * 2;
    const color = ring % 2 === 0 ? "#D9A73B" : "#7E2A38";
    for (let petal = 0; petal < petals; petal += 1) {
      const angle = petal * 360 / petals;
      markup += `<g transform="rotate(${angle} ${center} ${center})"><path d="M ${center} ${center - radius} q 3 5 0 10" fill="none" stroke="${color}" stroke-width="1.4"/></g>`;
    }
    markup += `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width=".6" opacity=".5"/>`;
  }
  svg.innerHTML = `${markup}<circle cx="${center}" cy="${center}" r="3" fill="#D9A73B"/>`;
}

const brandMark = document.getElementById("brandMandala");
if (brandMark) buildMandala(brandMark);

const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
navToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
});
navLinks.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open navigation menu");
  });
});

let scrollTicking = false;
window.addEventListener("scroll", () => {
  if (scrollTicking) return;
  scrollTicking = true;
  window.requestAnimationFrame(() => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
    document.documentElement.style.setProperty("--scroll-progress", progress.toFixed(4));
    scrollTicking = false;
  });
}, { passive: true });

let paintings = [];
let activeFilter = "all";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function bucketFor(price) {
  return PRICE_BUCKETS.find(bucket => price >= bucket.min && price < bucket.max) || PRICE_BUCKETS[PRICE_BUCKETS.length - 1];
}

function formatPrice(price) {
  return `₹${Number(price).toLocaleString("en-IN")}`;
}

function renderFilters() {
  const filterWrap = document.getElementById("filters");
  const buckets = [{ id: "all", label: "All pieces" }, ...PRICE_BUCKETS];
  filterWrap.innerHTML = buckets.map(bucket =>
    `<button class="filter-btn ${activeFilter === bucket.id ? "active" : ""}" data-filter="${bucket.id}" aria-pressed="${activeFilter === bucket.id}">${bucket.label}</button>`
  ).join("");

  filterWrap.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      renderFilters();
      renderGallery();
    });
  });
}

function makeWhatsAppLink(painting) {
  const message = encodeURIComponent(`Hi! I'm interested in "${painting.title}" (${formatPrice(painting.price)}).`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

function paintingCard(painting) {
  const title = escapeHtml(painting.title);
  const image = escapeHtml(painting.image);
  const description = escapeHtml(painting.desc);
  const size = escapeHtml(painting.size);
  return `<article class="card">
    <div class="card-img"><img src="${image}" alt="${title}" loading="lazy"></div>
    <div class="card-body">
      <div class="card-heading"><h4 class="card-title-inline">${title}</h4><span class="card-price">${formatPrice(painting.price)}</span></div>
      ${description ? `<p class="card-description">${description}</p>` : ""}
      ${size ? `<p class="card-size">${size}</p>` : ""}
      <a class="card-buy" href="${makeWhatsAppLink(painting)}" target="_blank" rel="noopener noreferrer">Ask to buy <span aria-hidden="true">↗</span></a>
    </div>
  </article>`;
}

function renderGallery() {
  const container = document.getElementById("galleryBlocks");
  const collectionCount = document.getElementById("collectionCount");
  collectionCount.textContent = `${String(paintings.length).padStart(2, "0")} ${paintings.length === 1 ? "ORIGINAL" : "ORIGINALS"}`;
  const buckets = activeFilter === "all" ? PRICE_BUCKETS : PRICE_BUCKETS.filter(bucket => bucket.id === activeFilter);
  container.innerHTML = buckets.map(bucket => {
    const items = paintings
      .filter(painting => bucketFor(Number(painting.price)).id === bucket.id)
      .sort((first, second) => Number(second.createdAt || 0) - Number(first.createdAt || 0));
    return `<section class="price-block">
      <div class="price-block-head"><h3>${bucket.label}</h3><span>${items.length} ${items.length === 1 ? "piece" : "pieces"}</span></div>
      ${items.length ? `<div class="grid">${items.map(paintingCard).join("")}</div>` : `<div class="empty-state">No paintings in this price range just yet.</div>`}
    </section>`;
  }).join("");
  observeCards();
}

const revealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 })
  : null;

function observeCards() {
  const elements = document.querySelectorAll(
    ".card:not(.in), .about-photo:not(.in), .section-head h2:not(.in), .section-head p:not(.in), .section-aside:not(.in), .price-block-head:not(.in), .collection-note:not(.in), .about-text > *:not(.in), .footer-invitation > *:not(.in)"
  );
  if (!revealObserver) {
    elements.forEach(element => element.classList.add("in"));
    return;
  }
  elements.forEach((element, index) => {
    element.style.setProperty("--d", `${index % 4 * 0.08}s`);
    revealObserver.observe(element);
  });
}

async function loadGallery() {
  const container = document.getElementById("galleryBlocks");
  try {
    const response = await fetch("/api/paintings");
    if (!response.ok) throw new Error("The gallery could not be loaded.");
    paintings = await response.json();
    if (!Array.isArray(paintings)) throw new Error("The gallery returned an invalid response.");
    renderFilters();
    renderGallery();
  } catch (error) {
    container.innerHTML = `<div class="empty-state">The gallery could not be loaded. Please refresh in a moment.</div>`;
    console.error("Unable to load gallery:", error);
  }
}

loadGallery();
observeCards();

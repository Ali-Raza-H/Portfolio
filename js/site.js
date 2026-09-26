const icons = {
  github:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .6a11.4 11.4 0 0 0-3.6 22.2c.6.1.8-.2.8-.5v-2.2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.1v3.2c0 .3.2.7.8.5A11.4 11.4 0 0 0 12 .6Z"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 3a2.4 2.4 0 1 0 0 4.8A2.4 2.4 0 0 0 5 3ZM3 9h4v12H3V9Zm6 0h3.8v1.6h.1c.5-1 1.8-2.1 3.8-2.1 4.1 0 4.9 2.7 4.9 6.2V21h-4v-5.5c0-1.3 0-3-1.8-3-1.9 0-2.1 1.4-2.1 2.9V21H9V9Z"/></svg>',
  tiktok:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.5 2h-3v13.1a2.4 2.4 0 1 1-2.4-2.4c.2 0 .5 0 .7.1V9.6A5.6 5.6 0 1 0 16.5 15V8.9a7.2 7.2 0 0 0 4 1.2V7.1a4.2 4.2 0 0 1-4-3.8V2Z"/></svg>',
};
const esc = (value) =>
  String(value).replace(
    /[&<>\"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[char],
  );
function addImageFallback(img, label) {
  const showFallback = () => {
    const wrapper = img.parentElement;
    if (!wrapper || wrapper.classList.contains("image-missing")) return;
    wrapper.classList.add("image-missing");
    wrapper.setAttribute("role", "img");
    wrapper.setAttribute("aria-label", `${label} image unavailable`);
    img.style.display = "none";
    const message = document.createElement("span");
    message.className = "image-fallback";
    message.setAttribute("aria-hidden", "true");
    message.textContent = "Image unavailable";
    wrapper.append(message);
  };
  img.addEventListener("error", showFallback, { once: true });
  if (img.complete && img.currentSrc && img.naturalWidth === 0) showFallback();
}
const socialMarkup = (identity) =>
  identity.socials.map((item) =>
    item.url
      ? `<a href="${
        esc(item.url)
      }" target="_blank" rel="noopener noreferrer" aria-label="${
        esc(item.label)
      } (opens in a new tab)">${icons[item.icon] || esc(item.label)}</a>`
      : `<span class="social-placeholder" title="Add your ${
        esc(item.label)
      } URL in content/site.json" aria-label="${esc(item.label)}">${
        icons[item.icon] || esc(item.label)
      }</span>`
  ).join("") + (identity.email
    ? `<a class="text-link" href="mailto:${esc(identity.email)}">Email me ↗</a>`
    : "");

function shared(identity) {
  document.querySelectorAll("[data-name]").forEach((node) =>
    node.textContent = identity.name
  );
  document.querySelectorAll("[data-cv-download]").forEach((node) => {
    node.href = identity.cv;
    node.setAttribute("download", "");
  });
  document.querySelectorAll("[data-cv-view]").forEach((node) =>
    node.href = identity.cv
  );
  document.querySelectorAll("[data-socials]").forEach((node) =>
    node.innerHTML = socialMarkup(identity)
  );
}
function home(data) {
  const page = data.home;
  document.querySelector("[data-home-kicker]").textContent = page.kicker;
  document.querySelector("[data-home-title]").textContent = page.title;
  document.querySelector("[data-home-intro]").textContent = page.intro;
  document.querySelector("[data-home-about-title]").textContent =
    page.aboutTitle;
  const portrait = document.querySelector("[data-portrait]");
  addImageFallback(portrait, "Portrait of Ali Raza");
  portrait.src = data.identity.portrait;
  const aboutIcons = [
    '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="4"/><path d="M24 3v7m0 28v7M3 24h7m28 0h7M24 10l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 5 18 10-18 10L6 15 24 5Z"/><path d="m6 23 18 10 18-10M6 31l18 10 18-10"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M39 19a16 16 0 0 0-28-7L7 16m0 0V8m0 8h8M9 29a16 16 0 0 0 28 7l4-4m0 0v8m0-8h-8"/><path d="M24 15v10l7 4"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 11h34v23H23l-9 7v-7H7V11Z"/><path d="M14 20h20m-20 7h13"/><circle cx="36" cy="36" r="8"/></svg>',
  ];
  document.querySelector("[data-home-about]").innerHTML = page.about.map(
    (item, index) =>
      `<article class="about-card"><div class="about-card-top"><span class="about-card-index">0${
        index + 1
      } / 04</span><span class="about-icon" aria-hidden="true">${
        aboutIcons[index] || aboutIcons[0]
      }</span></div><p>${esc(item)}</p></article>`,
  ).join("");
  document.querySelector("[data-facts]").innerHTML = page.facts.map((
    [value, label],
  ) => `<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`)
    .join("");
}
function projects(data) {
  const projectLinks = (project) => {
    const links = [];
    if (project.github) {
      links.push(
        `<a href="${
          esc(project.github)
        }" target="_blank" rel="noopener noreferrer" aria-label="${
          esc(project.title)
        } source code on GitHub (opens in a new tab)">GitHub ↗</a>`,
      );
    }
    if (project.demo) {
      links.push(
        `<a href="${
          esc(project.demo)
        }" target="_blank" rel="noopener noreferrer" aria-label="${
          esc(project.title)
        } live demo (opens in a new tab)">Live demo ↗</a>`,
      );
    }
    return links.length
      ? `<div class="project-links">${links.join("")}</div>`
      : '<p class="project-links project-links-empty">Links coming soon</p>';
  };
  document.querySelector("[data-projects]").innerHTML = data.projects.map((
    project,
    index,
  ) =>
    `<article class="project"><div class="project-index">${
      String(index + 1).padStart(2, "0")
    } / ${
      esc(project.year)
    }</div><div class="project-main"><p class="project-subtitle">${
      esc(project.subtitle)
    }</p><h2>${esc(project.title)}</h2><p class="project-summary">${
      esc(project.summary)
    }</p><ul>${
      project.details.map((detail) => `<li>${esc(detail)}</li>`).join("")
    }</ul><p class="tags">${
      project.tags.map((tag) => `<span>${esc(tag)}</span>`).join("")
    }</p>${projectLinks(project)}</div><div class="project-side"><span>${
      esc(project.status)
    }</span></div></article>`
  ).join("");
}
function skills(data) {
  document.querySelector("[data-skills]").innerHTML = data.skills.map((
    [title, items],
    index,
  ) =>
    `<section class="skill-row"><p>${
      String(index + 1).padStart(2, "0")
    }</p><h2>${esc(title)}</h2><div>${
      items.map((item) => `<span>${esc(item)}</span>`).join("")
    }</div></section>`
  ).join("");
  document.querySelector("[data-experience]").innerHTML = data.experience.map((
    role,
    index,
  ) =>
    `<article class="experience-card"><div class="experience-meta"><span>${
      String(index + 1).padStart(2, "0")
    } / ${esc(role.period)}</span><span class="experience-type">${
      esc(role.type)
    }</span></div><div class="experience-body"><p class="experience-organization">${
      esc(role.organization)
    }</p><h3>${esc(role.role)}</h3><p class="experience-summary">${
      esc(role.summary)
    }</p><ul>${role.details.map((detail) => `<li>${esc(detail)}</li>`).join("")}</ul></div><span class="experience-arrow" aria-hidden="true">↗</span></article>`
  ).join("");
  const timeline = document.querySelector("[data-journey]");
  timeline.classList.add("timeline");
  timeline.innerHTML = data.journey.map(([date, title, copy]) =>
    `<article class="journey-item"><time>${esc(date)}</time><div><h2>${
      esc(title)
    }</h2><p>${esc(copy)}</p></div></article>`
  ).join("");
}
// Mosaic gallery layout -------------------------------------------------
// A piece can declare its own width/height in "design pixels": the numbers
// you would use when designing against a 1200px-wide canvas. They are not
// used as literal CSS pixels, so the mosaic stays fluid across devices.
//   width  -> how many of the gallery's 12 columns the piece occupies
//   height -> the piece's target aspect ratio (width / height), which the
//             mosaic packer turns into a row span
// Anything missing falls back to the piece's own image proportions.
const MOSAIC_COLUMNS = 10;
const MOSAIC_DESIGN_WIDTH = 1200;
const MOSAIC_ROW_UNIT = 9; // px per implicit grid row; spans are computed in these
const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);
const positiveNumber = (value) => {
  const parsed = typeof value === "string"
    ? parseFloat(value)
    : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
// Accepts 420, "420", "420px" and returns a design-pixel number, else 0.
const designPixels = (value) => {
  if (typeof value === "string" && !/^\s*[\d.]+\s*(px)?\s*$/i.test(value)) {
    return 0;
  }
  return positiveNumber(value);
};
function graphics(data) {
  const projects = data.graphicsProjects || [];
  const imageSettings = (piece) => {
    const width = designPixels(piece.width);
    const height = designPixels(piece.height);
    const scale = positiveNumber(piece.scale) || 1;
    // Width in design pixels -> column span out of 12. Without an explicit
    // width we keep the old size/scale behaviour as a sensible default.
    const fallbackColumns = piece.size === "tall"
      ? 5
      : piece.size === "wide"
      ? 7
      : 4;
    const span = width
      ? clampNumber(
        Math.round((width / MOSAIC_DESIGN_WIDTH) * MOSAIC_COLUMNS * scale),
        1,
        MOSAIC_COLUMNS,
      )
      : clampNumber(Math.round(fallbackColumns * scale), 1, MOSAIC_COLUMNS);
    // Explicit width+height gives an exact aspect ratio. With only a ratio we
    // pass it through; with neither the image keeps its natural proportions.
    const ratio = width && height
      ? `${width} / ${height}`
      : /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(piece.ratio || "")
      ? piece.ratio
      : "auto";
    // Per-image toggle: contain by default so artwork is never cropped, and
    // "cover" only where a piece explicitly asks for it.
    const fit = ["cover", "contain", "fill"].includes(piece.fit)
      ? piece.fit
      : "contain";
    const positions = [
      "center", "center top", "center bottom", "left", "right", "top",
      "bottom", "left center", "right center", "left top", "right top",
      "left bottom", "right bottom",
    ];
    const position = positions.includes(piece.position)
      ? piece.position
      : "center";
    return {
      className: ratio === "auto" ? "" : " image-framed",
      span,
      // The mobile grid is 4 columns wide, not 12, so spans are re-derived:
      // only genuinely small pieces stay two-up; everything else goes full
      // width, which is the only sane reading of a 4-column track.
      style: `--art-span: ${span}; --art-span-mobile: ${
        span <= 3 ? 2 : 4
      }; --art-ratio: ${esc(ratio)}; --art-fit: ${fit}; --art-position: ${
        esc(position)
      };`,
    };
  };


  const renderPiece = (piece, index) => {
    const settings = imageSettings(piece);
    const title = typeof piece.title === "string" && piece.title.trim() &&
        !/add your/i.test(piece.title)
      ? piece.title
      : "";
    const category = typeof piece.category === "string" && piece.category.trim()
      ? piece.category
      : "Graphic design";
    const alt = typeof piece.alt === "string" && piece.alt.trim() &&
        !/replace this/i.test(piece.alt)
      ? piece.alt
      : `Graphic design work ${String(index + 1).padStart(2, "0")}: ${category}.`;
    const description = typeof piece.description === "string"
      ? piece.description.trim()
      : "";
    return `<article class="graphic-piece graphic-piece-${
      index % 2 === 0 ? "image-first" : "copy-first"
    }" style="${settings.style}"><figure class="graphic-piece-visual"><div class="graphic-image${
      settings.className
    }"><img src="${
      esc(piece.image)
    }" alt="${
      esc(alt)
    }" loading="lazy" decoding="async"></div></figure><div class="graphic-piece-copy"><p class="graphic-piece-kicker">${
      String(index + 1).padStart(2, "0")
    } / ${esc(category)}</p><h3>${
      esc(title || `Bliss55 — Piece ${String(index + 1).padStart(2, "0")}`)
    }</h3><p class="graphic-piece-description${
      /^PLACEHOLDER/i.test(description) ? " is-placeholder" : ""
    }">${esc(description || "Add a paragraph explaining the brief, intended audience, visual idea, and key choices behind this piece.")}</p></div></article>`;
  };



  const renderProject = (project, projectIndex) => {
    const pieces = Array.isArray(project.pieces) ? project.pieces : [];
    const metadata = [project.client, project.year, project.discipline]
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => `<span>${esc(item)}</span>`)
      .join("");
    const paragraphs = (items) => {
      const entries = Array.isArray(items) ? items : [items];
      return entries.filter((item) => typeof item === "string" && item.trim())
        .map((item) => `<p>${esc(item)}</p>`).join("");
    };
    const storySection = (heading, content) => {
      const copy = paragraphs(content);
      return copy
        ? `<section class="graphic-story-block"><h3>${heading}</h3>${copy}</section>`
        : "";
    };
    const narrative = [
      storySection("Thinking &amp; direction", project.thinking),
      storySection("Process", project.process),
      storySection("The brief", project.brief),
      storySection("Outcome &amp; reflection", project.outcome),
    ].join("");
    const overview = typeof project.overview === "string" && project.overview.trim()
      ? `<p class="graphic-case-overview">${esc(project.overview)}</p>`
      : "";
    const title = typeof project.title === "string" && project.title.trim()
      ? project.title
      : `Project ${projectIndex + 1}`;
    return `<article class="graphic-case-study"><header class="graphic-case-header"><div><p class="graphic-case-index">CASE STUDY / ${
      String(projectIndex + 1).padStart(2, "0")
    }</p><h2 id="graphic-project-${projectIndex}-title">${esc(title)}</h2></div><div class="graphic-case-meta">${metadata}</div></header>${overview}${
      narrative ? `<div class="graphic-case-narrative">${narrative}</div>` : ""
    }${
      pieces.length
        ? `<div class="graphics-gallery" role="group" aria-labelledby="graphic-project-${projectIndex}-title">${pieces.map(renderPiece).join("")}</div>`
        : '<p class="graphic-case-note">Artwork for this project is being added.</p>'
    }</article>`;
  };
  document.querySelector("[data-graphics]").innerHTML = projects.length
    ? projects.map(renderProject).join("")
    : '<p class="graphic-case-note">Graphic design case studies are being added.</p>';
  document.querySelectorAll("[data-graphics] .graphic-image img").forEach((img) =>
    addImageFallback(img, img.alt || "Graphic design work")
  );
  layoutGalleries();
}

// Masonry packing -------------------------------------------------------
// Each piece spans --art-span columns; the other axis is a row span counted in
// fixed 8px units, with dense flow filling the gaps left under taller pieces.
// That is what makes the gallery read as a mosaic instead of a plain table.
//
// The image height comes from the declared width/height ratio, or from the
// image's own proportions when a piece does not set one. Because the ratio is
// unitless, the same numbers hold at any viewport width.
//
// Re-packed whenever the result can have changed: viewport resize, webfont
// load, and each image as it decodes. Images are lazy-loaded, so pieces far
// below the fold report a height of 0 until they load and are skipped for now;
// they are packed as soon as they arrive.
function layoutGalleries() {
  const galleries = document.querySelectorAll(
    "[data-graphics] .graphics-gallery",
  );
  if (!galleries.length) return;
  let frame = 0;
  const pack = () => {
    frame = 0;
    galleries.forEach((gallery) => {
      const styles = getComputedStyle(gallery);
      const gap = parseFloat(styles.rowGap) || 0;
      if (!gallery.clientWidth) return;
      gallery.querySelectorAll(".graphic-piece").forEach((piece) => {
        const box = piece.querySelector(".graphic-image");
        const copy = piece.querySelector(".graphic-piece-copy");
        if (!box) return;
        // Measure what the browser actually laid out rather than recomputing
        // it here, so CSS (aspect-ratio, max-height, contain) stays the single
        // source of truth for the image box.
        const imageHeight = box.getBoundingClientRect().height;
        if (!imageHeight) return;
        // The caption is part of the piece, so it has to be included in the
        // span or the text overflows its row. Read the content box rather
        // than offsetHeight so the value is independent of any height the
        // grid has already handed this piece.
        const copyHeight = copy ? copy.getBoundingClientRect().height : 0;
        // N rows occupy N * unit + (N - 1) * gap. Invert that for the height
        // needed, and add a spare row so rounding never clips the caption.
        const content = imageHeight + copyHeight;
        const rows = Math.max(
          1,
          Math.ceil((content + gap) / (MOSAIC_ROW_UNIT + gap)) + 1,
        );
        // Only write when it actually changes, so a repack cannot oscillate.
        if (piece.dataset.artRows !== String(rows)) {
          piece.dataset.artRows = String(rows);
          piece.style.setProperty("--art-rows", String(rows));
        }
      });
    });
  };
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(pack);
  };
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });
  if (document.fonts?.ready) {
    document.fonts.ready.then(schedule).catch(() => {});
  }
  document.querySelectorAll("[data-graphics] .graphic-image img").forEach(
    (img) => {
      if (img.complete) return;
      img.addEventListener("load", schedule, { once: true });
      img.addEventListener("error", schedule, { once: true });
    },
  );
  schedule();
  // Late-loading images change the measured height of pieces further down the
  // page, which changes their row spans, which moves them. Settle by
  // repacking for a short window after load rather than only on each event.
  let settle = 0;
  const settleUntil = Date.now() + 4000;
  const tick = () => {
    schedule();
    if (Date.now() < settleUntil) settle = setTimeout(tick, 250);
  };
  settle = setTimeout(tick, 250);
  window.addEventListener(
    "pagehide",
    () => clearTimeout(settle),
    { once: true },
  );
}
function contact(identity) {
  const valueLink = (label, value, href) =>
    value
      ? `<div class="contact-row"><span>${esc(label)}</span><a href="${
        esc(href)
      }" aria-label="${esc(label)}: ${esc(value)}">${esc(value)} <b aria-hidden="true">↗</b></a></div>`
      : `<div class="contact-row"><span>${
        esc(label)
      }</span><em>Add this in content/site.json</em></div>`;
  const rows = [
    valueLink("Email", identity.email, `mailto:${identity.email}`),
    valueLink("Phone", identity.phone, `tel:${identity.phone}`),
    `<div class="contact-row"><span>Location</span><strong>${
      esc(identity.location)
    }</strong></div>`,
    ...identity.socials.map((social) =>
      valueLink(
        social.label,
        social.url
          ? social.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
          : "",
        social.url,
      )
    ),
  ];
  document.querySelector("[data-contact-details]").innerHTML = rows.join("");
}
function animatePage() {
  const targets = document.querySelectorAll(
    ".page-intro, .home-hero .hero-copy, .portrait-wrap, .section-head, .about-copy, .facts, .project, .skill-row, .journey-item, .graphic-case-study, .contact-main > *",
  );
  targets.forEach((target, index) => {
    target.dataset.reveal = "";
    target.style.setProperty(
      "--reveal-delay",
      `${Math.min(index % 5, 4) * 70}ms`,
    );
  });
  const graphicPieces = document.querySelectorAll(
    ".graphic-case-study .graphic-piece",
  );
  graphicPieces.forEach((piece, index) => {
    piece.dataset.reveal = "";
    piece.style.setProperty("--reveal-delay", `${(index % 5) * 70}ms`);
  });
  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    targets.forEach((target) => target.classList.add("is-visible"));
    graphicPieces.forEach((piece) => piece.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  targets.forEach((target) => observer.observe(target));
  graphicPieces.forEach((piece) => observer.observe(piece));
}
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("content/site.json");
    if (!response.ok) throw new Error("Unable to load content");
    const data = await response.json();
    shared(data.identity);
    if (document.body.dataset.page === "home") home(data);
    if (document.body.dataset.page === "projects") projects(data);
    if (document.body.dataset.page === "skills") skills(data);
    if (document.body.dataset.page === "graphics") graphics(data);
    if (document.body.dataset.page === "contact") contact(data.identity);
    animatePage();
  } catch (error) {
    document.body.classList.add("content-error");
    const message = document.createElement("p");
    message.className = "content-error-message";
    message.setAttribute("role", "alert");
    message.textContent =
      "Portfolio content could not load. Please reload the page or open it from the hosted site / a local web server.";
    document.querySelector("main")?.prepend(message);
    console.error(error);
  }
});

(() => {
  "use strict";

  // Update this once and your age will always stay correct.
  // Example: "2008-03-14"
  const BIRTHDATE_ISO = "YYYY-MM-DD";

  const TAGLINES = [
    "Learning web development.",
    "Building cool projects.",
    "Designing with creativity.",
    "Eager to grow and learn."
  ];

  const PROJECTS_URL = "projects.json";
  const STORAGE_KEY_THEME = "theme";

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }

  function safeStorageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  function isTheme(value) {
    return value === "dark" || value === "light";
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function storedTheme() {
    const value = safeStorageGet(STORAGE_KEY_THEME);
    return isTheme(value) ? value : null;
  }

  function effectiveTheme() {
    return storedTheme() || systemTheme();
  }

  function applyTheme(theme) {
    if (!isTheme(theme)) return;
    document.documentElement.dataset.theme = theme;
  }

  function updateThemeButton(button) {
    if (!button) return;

    const current = effectiveTheme();
    const next = current === "dark" ? "light" : "dark";
    const label = button.querySelector(".btn-label");
    if (label) label.textContent = next === "dark" ? "Dark" : "Light";

    button.setAttribute("aria-label", `Switch to ${next} theme`);
    button.title = "Click to toggle theme. Shift+Click to use system theme.";
  }

  function initTheme() {
    const button = document.getElementById("theme-toggle");
    const saved = storedTheme();
    if (saved) applyTheme(saved);
    else applyTheme(systemTheme());
    updateThemeButton(button);

    if (button) {
      button.addEventListener("click", (event) => {
        if (event.shiftKey) {
          safeStorageRemove(STORAGE_KEY_THEME);
          applyTheme(systemTheme());
          updateThemeButton(button);
          return;
        }

        const next = effectiveTheme() === "dark" ? "light" : "dark";
        safeStorageSet(STORAGE_KEY_THEME, next);
        applyTheme(next);
        updateThemeButton(button);
      });
    }

    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq) {
      const onChange = () => {
        if (!storedTheme()) {
          applyTheme(systemTheme());
          updateThemeButton(button);
        }
      };
      if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
      else if (typeof mq.addListener === "function") mq.addListener(onChange);
    }
  }

  function parseISODate(iso) {
    if (!iso) return null;
    const trimmed = String(iso).trim();
    if (trimmed === "YYYY-MM-DD") return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;

    return { year, month, day };
  }

  function computeAge(birth, now) {
    const today = now || new Date();
    let age = today.getFullYear() - birth.year;
    const m = today.getMonth() + 1;
    const d = today.getDate();
    const hadBirthday = m > birth.month || (m === birth.month && d >= birth.day);
    if (!hadBirthday) age -= 1;
    return age;
  }

  function initAge() {
    const ageEl = document.getElementById("age");
    const ageRow = document.getElementById("age-row");
    if (!ageEl) return;

    const birth = parseISODate(BIRTHDATE_ISO);
    if (!birth) {
      if (ageRow) ageRow.style.display = "none";
      return;
    }

    const age = computeAge(birth);
    if (!Number.isFinite(age) || age < 0 || age > 130) {
      if (ageRow) ageRow.style.display = "none";
      return;
    }

    ageEl.textContent = String(age);
  }

  function initYear() {
    const el = document.getElementById("year");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function initTicker() {
    const el = document.getElementById("tagline");
    if (!el) return;
    if (prefersReducedMotion()) return;

    let index = 0;
    const tick = () => {
      index = (index + 1) % TAGLINES.length;
      el.classList.add("is-swapping");
      window.setTimeout(() => {
        el.textContent = TAGLINES[index];
        el.classList.remove("is-swapping");
      }, 180);
    };

    window.setInterval(tick, 2600);
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeProject(raw, index) {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : slugify(title) || `project-${index}`;
    const type = typeof raw.type === "string" && raw.type.trim() ? raw.type.trim().toLowerCase() : "other";

    const links = Array.isArray(raw.links)
      ? raw.links
          .filter((l) => l && typeof l.url === "string" && typeof l.label === "string")
          .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
          .filter((l) => l.label && l.url)
      : [];

    const tags = Array.isArray(raw.tags)
      ? raw.tags
          .filter((t) => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const details = raw.details && typeof raw.details === "object" ? raw.details : null;
    const media = raw.media && typeof raw.media === "object" ? raw.media : null;

    const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
    const featured = Boolean(raw.featured);
    const year = Number.isFinite(raw.year) ? raw.year : null;

    return { id, title, summary, type, year, tags, links, featured, details, media };
  }

  function typeLabel(type) {
    const t = String(type || "").toLowerCase();
    if (t === "repo") return "Repo";
    if (t === "python") return "Python";
    if (t === "app") return "App";
    if (t === "tool") return "Tool";
    if (t === "website") return "Website";
    if (t === "other") return "Other";
    return t ? t[0].toUpperCase() + t.slice(1) : "Other";
  }

  function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === "string") el.textContent = text;
    return el;
  }

  function setHint(text) {
    const hint = document.getElementById("projects-hint");
    if (hint) hint.textContent = text || "";
  }

  function getFocusable(container) {
    if (!container) return [];
    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selector)).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none";
    });
  }

  function initModal() {
    const modal = document.getElementById("project-modal");
    const dialog = modal ? modal.querySelector(".modal-dialog") : null;
    if (!modal || !dialog) return null;

    const titleEl = document.getElementById("modal-title");
    const badgeEl = document.getElementById("modal-badge");
    const metaEl = document.getElementById("modal-meta");
    const linksEl = document.getElementById("modal-links");
    const contentEl = document.getElementById("modal-content");
    const galleryEl = document.getElementById("modal-gallery");

    let lastActive = null;

    const close = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";

      document.removeEventListener("keydown", onKeydown);
      modal.removeEventListener("click", onOverlayClick);

      if (lastActive && typeof lastActive.focus === "function") lastActive.focus();
      lastActive = null;
    };

    const onOverlayClick = (event) => {
      const target = event.target;
      if (target && target.closest && target.closest("[data-modal-close]")) close();
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusable(dialog);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isShift = event.shiftKey;
      const active = document.activeElement;

      if (!isShift && active === last) {
        event.preventDefault();
        first.focus();
      } else if (isShift && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    const renderLinks = (links) => {
      if (!linksEl) return;
      linksEl.replaceChildren();
      (links || []).forEach((l) => {
        const a = makeEl("a", "btn btn-secondary btn-sm", l.label);
        a.href = l.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        linksEl.append(a);
      });
    };

    const renderContent = (project) => {
      if (badgeEl) badgeEl.textContent = typeLabel(project.type);
      if (titleEl) titleEl.textContent = project.title || "Untitled";

      if (metaEl) {
        metaEl.replaceChildren();
        if (project.year) metaEl.append(makeEl("span", null, String(project.year)));
        (project.tags || []).slice(0, 6).forEach((t) => metaEl.append(makeEl("span", null, `#${t}`)));
      }

      renderLinks(project.links);

      if (contentEl) {
        contentEl.replaceChildren();
        if (project.summary) contentEl.append(makeEl("p", null, project.summary));

        const details = project.details || null;
        if (details && typeof details === "object") {
          if (typeof details.problem === "string" && details.problem.trim()) {
            contentEl.append(makeEl("div", "modal-section-title", "Problem"));
            contentEl.append(makeEl("p", null, details.problem.trim()));
          }
          if (typeof details.solution === "string" && details.solution.trim()) {
            contentEl.append(makeEl("div", "modal-section-title", "Solution"));
            contentEl.append(makeEl("p", null, details.solution.trim()));
          }
          if (typeof details.role === "string" && details.role.trim()) {
            contentEl.append(makeEl("div", "modal-section-title", "Role"));
            contentEl.append(makeEl("p", null, details.role.trim()));
          }
          if (Array.isArray(details.highlights) && details.highlights.length) {
            const list = makeEl("ul", "bullets");
            details.highlights
              .filter((h) => typeof h === "string")
              .map((h) => h.trim())
              .filter(Boolean)
              .slice(0, 8)
              .forEach((h) => list.append(makeEl("li", null, h)));
            if (list.children.length) {
              contentEl.append(makeEl("div", "modal-section-title", "Highlights"));
              contentEl.append(list);
            }
          }
        }
      }

      if (galleryEl) {
        galleryEl.replaceChildren();
        const media = project.media || null;
        if (media && typeof media === "object") {
          if (media.video && typeof media.video === "object") {
            const provider = String(media.video.provider || "").toLowerCase();
            const id = String(media.video.id || "").trim();
            const url = typeof media.video.url === "string" ? media.video.url.trim() : "";
            let src = "";
            if (provider === "youtube" && id) src = `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
            if (provider === "vimeo" && id) src = `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
            if ((provider === "file" || provider === "local") && url) src = url;

            if (src) {
              const frame = makeEl("div", "video-frame");
              if (provider === "file" || provider === "local") {
                const video = document.createElement("video");
                video.controls = true;
                video.preload = "metadata";
                video.playsInline = true;
                video.src = src;
                video.title = `${project.title || "Project"} video`;
                frame.append(video);
              } else {
                const iframe = document.createElement("iframe");
                iframe.src = src;
                iframe.allow =
                  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
                iframe.allowFullscreen = true;
                iframe.title = `${project.title || "Project"} video`;
                frame.append(iframe);
              }
              galleryEl.append(frame);
            }
          }

          if (Array.isArray(media.gallery) && media.gallery.length) {
            const grid = makeEl("div", "gallery-grid");
            media.gallery
              .filter((p) => typeof p === "string")
              .map((p) => p.trim())
              .filter(Boolean)
              .slice(0, 8)
              .forEach((src) => {
                const lower = src.toLowerCase();
                if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".ogg")) {
                  const video = document.createElement("video");
                  video.controls = true;
                  video.preload = "metadata";
                  video.playsInline = true;
                  video.src = src;
                  video.title = `${project.title || "Project"} video`;
                  grid.append(video);
                  return;
                }

                const img = document.createElement("img");
                img.loading = "lazy";
                img.src = src;
                img.alt = `${project.title || "Project"} screenshot`;
                grid.append(img);
              });
            if (grid.children.length) galleryEl.append(grid);
          }
        }
      }
    };

    const open = (project, trigger) => {
      lastActive = trigger || document.activeElement;
      renderContent(project);

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      modal.addEventListener("click", onOverlayClick);
      document.addEventListener("keydown", onKeydown);
      dialog.focus();
    };

    return { open, close };
  }

  function projectHasDetails(project) {
    if (project.details && typeof project.details === "object") return true;
    const media = project.media && typeof project.media === "object" ? project.media : null;
    if (!media) return false;
    if (media.video && typeof media.video === "object" && media.video.id) return true;
    if (Array.isArray(media.gallery) && media.gallery.length) return true;
    return false;
  }

  function renderProjects(projects, modalApi) {
    const grid = document.getElementById("projects-grid");
    const filtersRoot = document.getElementById("project-filters");
    if (!grid || !filtersRoot) return;

    const normalized = projects.map((p, i) => normalizeProject(p, i)).filter((p) => p.title);
    const totalCount = normalized.length;

    const typeOrder = ["website", "repo", "python", "app", "tool", "other"];
    const types = Array.from(new Set(normalized.map((p) => p.type))).sort((a, b) => {
      const ia = typeOrder.indexOf(a);
      const ib = typeOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    const hasFeatured = normalized.some((p) => p.featured);
    const filterKeys = ["all", ...(hasFeatured ? ["featured"] : []), ...types];

    let activeFilter = "all";

    const setPressed = () => {
      filtersRoot.querySelectorAll("button.filter").forEach((btn) => {
        const key = btn.dataset.filter;
        btn.setAttribute("aria-pressed", key === activeFilter ? "true" : "false");
      });
    };

    const filterLabel = (key) => {
      if (key === "all") return "All";
      if (key === "featured") return "Featured";
      return typeLabel(key);
    };

    const renderFilters = () => {
      filtersRoot.replaceChildren();
      filterKeys.forEach((key) => {
        const btn = makeEl("button", "filter", filterLabel(key));
        btn.type = "button";
        btn.dataset.filter = key;
        btn.setAttribute("aria-pressed", key === activeFilter ? "true" : "false");
        btn.addEventListener("click", () => {
          activeFilter = key;
          setPressed();
          renderGrid();
        });
        filtersRoot.append(btn);
      });
    };

    const renderGrid = () => {
      grid.replaceChildren();

      const shown = normalized.filter((p) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "featured") return p.featured;
        return p.type === activeFilter;
      });

      const noun = (n) => (n === 1 ? "project" : "projects");
      if (activeFilter === "all") setHint(`${shown.length} ${noun(shown.length)}`);
      else setHint(`${filterLabel(activeFilter)}: ${shown.length} of ${totalCount} ${noun(totalCount)}`);

      if (shown.length === 0) {
        const empty = makeEl("div", "card", "No projects found for this filter.");
        grid.append(empty);
        return;
      }

      const frag = document.createDocumentFragment();
      shown.forEach((p) => frag.append(renderProjectCard(p, modalApi)));
      grid.append(frag);
    };

    renderFilters();
    renderGrid();
  }

  function renderProjectCard(project, modalApi) {
    const card = makeEl("article", "project-card");
    card.id = `project-${project.id}`;

    const thumb = makeEl("div", "project-thumb");
    const media = project.media && typeof project.media === "object" ? project.media : null;
    if (media && typeof media.thumbnail === "string" && media.thumbnail.trim()) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = media.thumbnail.trim();
      img.alt = `${project.title} thumbnail`;
      thumb.append(img);
    }
    card.append(thumb);

    const body = makeEl("div", "project-body");

    const topline = makeEl("div", "project-topline");
    topline.append(makeEl("div", "badge", typeLabel(project.type)));
    if (project.year) topline.append(makeEl("div", "project-year", String(project.year)));
    body.append(topline);

    body.append(makeEl("h3", "project-title", project.title));
    if (project.summary) body.append(makeEl("p", "project-summary", project.summary));

    if (Array.isArray(project.tags) && project.tags.length) {
      const row = makeEl("div", "tag-row");
      project.tags.slice(0, 3).forEach((t) => row.append(makeEl("span", "tag", t)));
      body.append(row);
    }

    card.append(body);

    const actions = makeEl("div", "project-actions");
    (project.links || []).slice(0, 3).forEach((l) => {
      const a = makeEl("a", "btn btn-ghost btn-sm", l.label);
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      actions.append(a);
    });

    if (modalApi && projectHasDetails(project)) {
      const btn = makeEl("button", "btn btn-secondary btn-sm", "Details");
      btn.type = "button";
      btn.addEventListener("click", () => modalApi.open(project, btn));
      actions.append(btn);
    }

    card.append(actions);
    return card;
  }

  async function initProjects() {
    const grid = document.getElementById("projects-grid");
    const filters = document.getElementById("project-filters");
    if (!grid || !filters) return;

    const modalApi = initModal();
    setHint("");

    let data;
    try {
      const res = await fetch(PROJECTS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      const isFile = window.location && window.location.protocol === "file:";
      setHint(
        isFile
          ? "Projects failed to load. If you opened index.html directly, preview via a local server (VS Code Live Server) so fetch() works."
          : "Projects failed to load."
      );
      const fallback = makeEl("div", "card", "Projects failed to load.");
      grid.replaceChildren(fallback);
      return;
    }

    if (!Array.isArray(data)) {
      setHint("Projects data format is invalid.");
      const fallback = makeEl("div", "card", "Projects data format is invalid.");
      grid.replaceChildren(fallback);
      return;
    }

    renderProjects(data, modalApi);
  }

  onReady(() => {
    initYear();
    initTheme();
    initAge();
    initTicker();
    initProjects();
  });
})();

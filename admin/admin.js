(() => {
  "use strict";

  const PROJECTS_CACHE_KEY = "portfolio.projects.synced.v1";
  const DEVS_PATH_HINT = "C:/Users/khada/Desktop/Devs/";
  const SCAN_SKIP_DIRS = new Set([
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "out",
    "__pycache__",
    ".venv",
    "venv"
  ]);
  const EXTENSION_TAGS = {
    ".html": "HTML",
    ".css": "CSS",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".jsx": "React",
    ".tsx": "React",
    ".py": "Python",
    ".java": "Java",
    ".kt": "Kotlin",
    ".cs": "C#",
    ".php": "PHP",
    ".go": "Go",
    ".rs": "Rust",
    ".sql": "SQL",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".md": "Markdown"
  };

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === "string") el.textContent = text;
    return el;
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function readString(value) {
    return typeof value === "string" ? value : "";
  }

  function readNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function ensureObject(value) {
    return isRecord(value) ? value : {};
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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

  function formatJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function tryFetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function supportsFileSystemAccess() {
    return typeof window.showOpenFilePicker === "function";
  }

  async function openJsonFileViaPicker() {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    const file = await handle.getFile();
    return { handle, text: await file.text() };
  }

  function openJsonFileViaInput() {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener(
        "change",
        async () => {
          const file = input.files && input.files[0];
          if (!file) {
            reject(new Error("No file selected."));
            return;
          }
          resolve({ handle: null, text: await file.text() });
        },
        { once: true }
      );
      input.click();
    });
  }

  async function openJsonFile() {
    if (supportsFileSystemAccess()) return openJsonFileViaPicker();
    return openJsonFileViaInput();
  }

  async function ensureWritePermission(handle) {
    if (!handle) return false;
    if (typeof handle.queryPermission !== "function" || typeof handle.requestPermission !== "function") return true;
    const opts = { mode: "readwrite" };
    const current = await handle.queryPermission(opts);
    if (current === "granted") return true;
    const next = await handle.requestPermission(opts);
    return next === "granted";
  }

  async function saveTextToHandle(handle, text) {
    const ok = await ensureWritePermission(handle);
    if (!ok) throw new Error("Permission denied.");
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  function supportsDirectoryPicker() {
    return typeof window.showDirectoryPicker === "function";
  }

  function readProjectsCache() {
    try {
      const raw = window.localStorage.getItem(PROJECTS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeProjectsCache(projects) {
    try {
      window.localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(serializeProjects(projects)));
    } catch {
      // ignore
    }
  }

  function titleFromFolderName(name) {
    return readString(name)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function normalizeSummaryText(text) {
    return readString(text).replace(/\s+/g, " ").trim();
  }

  function firstSentence(text) {
    const normalized = normalizeSummaryText(text);
    if (!normalized) return "";
    const parts = normalized.split(/(?<=[.!?])\s+/);
    return parts[0] || normalized;
  }

  function mergeUniqueStrings(primary, secondary, limit) {
    const out = [];
    [...ensureArray(primary), ...ensureArray(secondary)].forEach((item) => {
      if (typeof item !== "string") return;
      const value = item.trim();
      if (!value || out.includes(value)) return;
      out.push(value);
    });
    return Number.isInteger(limit) ? out.slice(0, limit) : out;
  }

  function inferTypeFromSignals(state) {
    const names = state.fileNames;
    const tags = state.tags;

    const hasWebMarker =
      names.has("index.html") ||
      names.has("package.json") ||
      names.has("vite.config.js") ||
      names.has("vite.config.ts") ||
      names.has("next.config.js");

    const hasAndroidMarker =
      names.has("androidmanifest.xml") ||
      names.has("build.gradle") ||
      names.has("build.gradle.kts") ||
      names.has("settings.gradle") ||
      names.has("settings.gradle.kts");

    if (hasAndroidMarker || tags.has("Kotlin")) return "app";
    if (tags.has("Python") && !hasWebMarker) return "python";
    if (hasWebMarker || tags.has("HTML") || tags.has("JavaScript") || tags.has("TypeScript")) return "website";
    if (state.hasGit) return "repo";
    return "other";
  }

  function readLinksFromText(text) {
    const matches = readString(text).match(/https?:\/\/[^\s)'"`]+/g) || [];
    const clean = matches.map((url) => url.replace(/[.,;:]$/, ""));
    const github = clean.find((url) => /github\.com/i.test(url)) || "";
    const live = clean.find((url) => !/github\.com/i.test(url)) || "";
    return { github, live };
  }

  async function readFileTextSafe(handle, maxChars) {
    try {
      const file = await handle.getFile();
      const text = await file.text();
      return readString(text).slice(0, maxChars || 12000);
    } catch {
      return "";
    }
  }

  async function scanDirectorySignals(dirHandle, depth, state) {
    if (depth > 2 || state.fileCount > 220) return;

    for await (const [entryName, entryHandle] of dirHandle.entries()) {
      const lowerName = entryName.toLowerCase();

      if (entryHandle.kind === "directory") {
        if (lowerName === ".git") {
          state.hasGit = true;
          continue;
        }
        if (SCAN_SKIP_DIRS.has(lowerName) || lowerName.startsWith(".")) continue;
        if (depth < 1) await scanDirectorySignals(entryHandle, depth + 1, state);
        continue;
      }

      state.fileCount += 1;
      state.fileNames.add(lowerName);

      const dot = lowerName.lastIndexOf(".");
      const ext = dot >= 0 ? lowerName.slice(dot) : "";
      const tag = EXTENSION_TAGS[ext];
      if (tag) state.tags.add(tag);

      if (!state.readmeText && /^readme(\.|$)/i.test(entryName)) {
        state.readmeText = await readFileTextSafe(entryHandle, 12000);
      }

      if (state.fileCount > 220) break;
    }
  }

  async function collectProjectsFromDirectory(rootHandle, existingProjects) {
    const existing = ensureArray(existingProjects);
    const byId = new Map();
    const byTitle = new Map();

    existing.forEach((project) => {
      if (!isRecord(project)) return;
      const id = readString(project.id).trim();
      const title = readString(project.title).trim();
      if (id) byId.set(id, project);
      if (title) byTitle.set(slugify(title), project);
    });

    const synced = [];
    const currentYear = new Date().getFullYear();

    for await (const [entryName, entryHandle] of rootHandle.entries()) {
      if (!entryHandle || entryHandle.kind !== "directory") continue;

      const lowerName = entryName.toLowerCase();
      if (lowerName.startsWith("_") || lowerName.startsWith(".")) continue;

      const state = {
        hasGit: false,
        fileCount: 0,
        fileNames: new Set(),
        tags: new Set(),
        readmeText: ""
      };

      await scanDirectorySignals(entryHandle, 0, state);
      if (state.fileCount === 0 && !state.hasGit) continue;

      const title = titleFromFolderName(entryName) || entryName;
      const id = slugify(entryName) || slugify(title) || `project-${synced.length + 1}`;
      const preserved = byId.get(id) || byTitle.get(slugify(title)) || null;

      const inferredType = inferTypeFromSignals(state);
      const summaryFromReadme = firstSentence(state.readmeText);
      const linksFromReadme = readLinksFromText(state.readmeText);

      const autoLinks = [];
      if (linksFromReadme.github) autoLinks.push({ label: "GitHub", url: linksFromReadme.github });
      if (linksFromReadme.live) autoLinks.push({ label: "Live Demo", url: linksFromReadme.live });

      const project = {
        id,
        title,
        summary: readString(preserved && preserved.summary).trim() || summaryFromReadme || `Project synced from ${entryName}.`,
        type: readString(preserved && preserved.type).trim() || inferredType,
        year: Number.isInteger(preserved && preserved.year) ? preserved.year : currentYear,
        tags: mergeUniqueStrings(preserved && preserved.tags, Array.from(state.tags), 8),
        links: ensureArray(preserved && preserved.links).length ? ensureArray(preserved.links) : autoLinks,
        featured: Boolean(preserved && preserved.featured),
        details: isRecord(preserved && preserved.details)
          ? preserved.details
          : {
              role: "Solo project",
              solution: summaryFromReadme || `Scanned from ${DEVS_PATH_HINT}${entryName}`
            },
        media: isRecord(preserved && preserved.media) ? preserved.media : {}
      };

      synced.push(project);
    }

    synced.sort((a, b) => readString(a.title).localeCompare(readString(b.title)));
    return synced;
  }

  function stripEmpty(value) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }

    if (Array.isArray(value)) {
      const arr = value.map((v) => stripEmpty(v)).filter((v) => v !== undefined);
      return arr.length ? arr : undefined;
    }

    if (isRecord(value)) {
      const out = {};
      Object.entries(value).forEach(([k, v]) => {
        const cleaned = stripEmpty(v);
        if (cleaned === undefined) return;
        out[k] = cleaned;
      });
      return Object.keys(out).length ? out : undefined;
    }

    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return value == null ? undefined : value;
  }

  function serializeProjects(projects) {
    const cleaned = stripEmpty(projects);
    return Array.isArray(cleaned) ? cleaned : [];
  }

  function ensureContentShape(raw) {
    const content = isRecord(raw) ? raw : {};

    if (!isRecord(content.hero)) content.hero = {};
    if (!isRecord(content.hero.quickInfo)) content.hero.quickInfo = {};
    if (!isRecord(content.hero.chips)) content.hero.chips = {};
    if (!isRecord(content.hero.illustration)) content.hero.illustration = {};
    if (!Array.isArray(content.hero.taglines)) content.hero.taglines = [];
    if (!Array.isArray(content.hero.cta)) content.hero.cta = [];

    while (content.hero.cta.length < 2) content.hero.cta.push({ label: "", href: "", variant: "secondary" });
    content.hero.cta = content.hero.cta.slice(0, 2).map((c) => (isRecord(c) ? c : { label: "", href: "" }));

    if (!isRecord(content.sections)) content.sections = {};
    const s = content.sections;

    if (!isRecord(s.about)) s.about = {};
    if (!isRecord(s.about.whatIbuild)) s.about.whatIbuild = {};
    if (!isRecord(s.about.howIwork)) s.about.howIwork = {};
    if (!Array.isArray(s.about.howIwork.bullets)) s.about.howIwork.bullets = [];

    if (!isRecord(s.projects)) s.projects = {};

    if (!isRecord(s.skills)) s.skills = {};
    if (!Array.isArray(s.skills.groups)) s.skills.groups = [];
    s.skills.groups = s.skills.groups.map((g) => {
      const group = isRecord(g) ? g : { title: "", items: [] };
      if (!Array.isArray(group.items)) group.items = [];
      return group;
    });

    if (!isRecord(s.education)) s.education = {};
    if (!Array.isArray(s.education.items)) s.education.items = [];
    s.education.items = s.education.items.map((it) => {
      const item = isRecord(it) ? it : { school: "", role: "", bullets: [] };
      if (!Array.isArray(item.bullets)) item.bullets = [];
      return item;
    });

    if (!isRecord(s.contact)) s.contact = {};

    return content;
  }

  function validateProjects(projects) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(projects)) {
      errors.push({ message: "projects.json must be an array." });
      return { errors, warnings };
    }

    const idCounts = new Map();
    projects.forEach((p, index) => {
      if (!isRecord(p)) {
        errors.push({ projectIndex: index, path: "", message: "Project must be an object." });
        return;
      }

      const title = typeof p.title === "string" ? p.title.trim() : "";
      const id = typeof p.id === "string" ? p.id.trim() : "";
      if (!title) errors.push({ projectIndex: index, path: "title", message: "Title is required." });
      if (!id) errors.push({ projectIndex: index, path: "id", message: "ID is required." });
      if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);

      const links = Array.isArray(p.links) ? p.links : [];
      links.forEach((l, li) => {
        const label = isRecord(l) && typeof l.label === "string" ? l.label.trim() : "";
        const url = isRecord(l) && typeof l.url === "string" ? l.url.trim() : "";
        if ((label && !url) || (!label && url)) {
          errors.push({
            projectIndex: index,
            path: `links[${li}]`,
            message: "Links must have both label and url."
          });
        }
      });

      if (p.year !== undefined && p.year !== null && !Number.isInteger(p.year)) {
        warnings.push({ projectIndex: index, path: "year", message: "Year should be an integer." });
      } else if (Number.isInteger(p.year)) {
        const y = p.year;
        const now = new Date().getFullYear();
        if (y < 1990 || y > now + 2) warnings.push({ projectIndex: index, path: "year", message: "Year looks out of range." });
      }

      const details = isRecord(p.details) ? p.details : null;
      if (details && Array.isArray(details.highlights) && details.highlights.length > 8) {
        warnings.push({ projectIndex: index, path: "details.highlights", message: "Highlights are sliced to 8 on the site." });
      }

      const media = isRecord(p.media) ? p.media : null;
      const extOk = (path) =>
        typeof path === "string" && /\.(png|jpe?g|webp|gif|svg|mp4|webm|ogg)$/i.test(path.trim());
      if (media && typeof media.thumbnail === "string" && media.thumbnail.trim() && !extOk(media.thumbnail)) {
        warnings.push({ projectIndex: index, path: "media.thumbnail", message: "Thumbnail file extension looks odd." });
      }
      if (media && Array.isArray(media.gallery) && media.gallery.length > 8) {
        warnings.push({ projectIndex: index, path: "media.gallery", message: "Gallery is sliced to 8 on the site." });
      }
      if (media && Array.isArray(media.gallery)) {
        media.gallery.forEach((g, gi) => {
          if (typeof g === "string" && g.trim() && !extOk(g)) {
            warnings.push({ projectIndex: index, path: `media.gallery[${gi}]`, message: "Gallery file extension looks odd." });
          }
        });
      }
    });

    Array.from(idCounts.entries()).forEach(([id, count]) => {
      if (count <= 1) return;
      projects.forEach((p, index) => {
        if (isRecord(p) && typeof p.id === "string" && p.id.trim() === id) {
          errors.push({ projectIndex: index, path: "id", message: `Duplicate ID: ${id}` });
        }
      });
    });

    return { errors, warnings };
  }

  function validateContent(content) {
    const errors = [];
    const warnings = [];

    if (!isRecord(content)) {
      errors.push({ message: "content.json must be an object." });
      return { errors, warnings };
    }

    const sections = isRecord(content.sections) ? content.sections : null;
    const requiredTitles = [
      ["sections.about.title", sections && isRecord(sections.about) ? sections.about.title : null],
      ["sections.projects.title", sections && isRecord(sections.projects) ? sections.projects.title : null],
      ["sections.skills.title", sections && isRecord(sections.skills) ? sections.skills.title : null],
      ["sections.education.title", sections && isRecord(sections.education) ? sections.education.title : null],
      ["sections.contact.title", sections && isRecord(sections.contact) ? sections.contact.title : null]
    ];
    requiredTitles.forEach(([path, value]) => {
      if (typeof value !== "string" || !value.trim()) errors.push({ path, message: "Title is required." });
    });

    const hero = isRecord(content.hero) ? content.hero : null;
    const taglines = hero && Array.isArray(hero.taglines) ? hero.taglines : [];
    const okTaglines = taglines
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
    if (okTaglines.length === 0) errors.push({ path: "hero.taglines", message: "At least 1 tagline is required." });

    if (typeof content.birthdateISO === "string" && content.birthdateISO.trim()) {
      if (!parseISODate(content.birthdateISO)) warnings.push({ path: "birthdateISO", message: "Birthdate ISO is invalid." });
    }

    const chips = hero && isRecord(hero.chips) ? hero.chips : null;
    if (chips) {
      if (typeof chips.emailHref === "string" && chips.emailHref.trim() && !chips.emailHref.trim().startsWith("mailto:")) {
        warnings.push({ path: "hero.chips.emailHref", message: "Email href should start with mailto:." });
      }
      if (typeof chips.phoneHref === "string" && chips.phoneHref.trim() && !chips.phoneHref.trim().startsWith("tel:")) {
        warnings.push({ path: "hero.chips.phoneHref", message: "Phone href should start with tel:." });
      }
    }

    return { errors, warnings };
  }

  const dom = {
    tabButtons: Array.from(document.querySelectorAll("[data-tab]")),
    tabProjects: document.getElementById("tab-projects"),
    tabContent: document.getElementById("tab-content"),

    projectsStatus: document.getElementById("projects-status"),
    projectsSyncFolder: document.getElementById("projects-sync-folder"),
    projectsOpen: document.getElementById("projects-open"),
    projectsSave: document.getElementById("projects-save"),
    projectsDownload: document.getElementById("projects-download"),
    projectsSearch: document.getElementById("projects-search"),
    projectsList: document.getElementById("projects-list"),
    projectAdd: document.getElementById("project-add"),
    projectDuplicate: document.getElementById("project-duplicate"),
    projectDelete: document.getElementById("project-delete"),
    projectUp: document.getElementById("project-up"),
    projectDown: document.getElementById("project-down"),
    projectIssues: document.getElementById("project-issues"),

    pTitle: document.getElementById("p-title"),
    pId: document.getElementById("p-id"),
    pType: document.getElementById("p-type"),
    pTypeCustom: document.getElementById("p-type-custom"),
    pYear: document.getElementById("p-year"),
    pFeatured: document.getElementById("p-featured"),
    pSummary: document.getElementById("p-summary"),
    pTags: document.getElementById("p-tags"),
    pTagAdd: document.getElementById("p-tag-add"),
    pTagAddBtn: document.getElementById("p-tag-add-btn"),
    pLinks: document.getElementById("p-links"),
    pLinkAdd: document.getElementById("p-link-add"),
    pLinkAddGithub: document.getElementById("p-link-add-github"),
    pLinkAddLive: document.getElementById("p-link-add-live"),
    pProblem: document.getElementById("p-problem"),
    pSolution: document.getElementById("p-solution"),
    pRole: document.getElementById("p-role"),
    pHighlights: document.getElementById("p-highlights"),
    pHighlightAdd: document.getElementById("p-highlight-add"),
    pHighlightAddBtn: document.getElementById("p-highlight-add-btn"),
    pThumb: document.getElementById("p-thumb"),
    pVideoProvider: document.getElementById("p-video-provider"),
    pVideoId: document.getElementById("p-video-id"),
    pVideoUrl: document.getElementById("p-video-url"),
    pGallery: document.getElementById("p-gallery"),
    pGalleryAdd: document.getElementById("p-gallery-add"),
    pGalleryAddBtn: document.getElementById("p-gallery-add-btn"),

    contentStatus: document.getElementById("content-status"),
    contentOpen: document.getElementById("content-open"),
    contentSave: document.getElementById("content-save"),
    contentDownload: document.getElementById("content-download"),
    contentIssues: document.getElementById("content-issues"),

    cBirthdate: document.getElementById("c-birthdate"),
    cHeroEyebrow: document.getElementById("c-hero-eyebrow"),
    cHeroTitle: document.getElementById("c-hero-title"),
    cHeroLede: document.getElementById("c-hero-lede"),
    cHeroIllustrationSrc: document.getElementById("c-hero-illustration-src"),
    cHeroIllustrationAlt: document.getElementById("c-hero-illustration-alt"),
    cTaglines: document.getElementById("c-taglines"),
    cTaglineAdd: document.getElementById("c-tagline-add"),
    cCta0Label: document.getElementById("c-cta0-label"),
    cCta0Href: document.getElementById("c-cta0-href"),
    cCta0Variant: document.getElementById("c-cta0-variant"),
    cCta1Label: document.getElementById("c-cta1-label"),
    cCta1Href: document.getElementById("c-cta1-href"),
    cCta1Variant: document.getElementById("c-cta1-variant"),
    cQiName: document.getElementById("c-qi-name"),
    cQiFocus: document.getElementById("c-qi-focus"),
    cQiSchool: document.getElementById("c-qi-school"),
    cChipPhoneLabel: document.getElementById("c-chip-phone-label"),
    cChipPhoneHref: document.getElementById("c-chip-phone-href"),
    cChipEmailLabel: document.getElementById("c-chip-email-label"),
    cChipEmailHref: document.getElementById("c-chip-email-href"),

    cAboutTitle: document.getElementById("c-about-title"),
    cAboutIntro: document.getElementById("c-about-intro"),
    cAboutWhatTitle: document.getElementById("c-about-what-title"),
    cAboutWhatP1: document.getElementById("c-about-what-p1"),
    cAboutWhatP2: document.getElementById("c-about-what-p2"),
    cAboutWhatMuted: document.getElementById("c-about-what-muted"),
    cAboutWorkTitle: document.getElementById("c-about-work-title"),
    cAboutWorkBullets: document.getElementById("c-about-work-bullets"),
    cAboutWorkAdd: document.getElementById("c-about-work-add"),

    cProjectsTitle: document.getElementById("c-projects-title"),
    cProjectsIntro: document.getElementById("c-projects-intro"),

    cSkillsTitle: document.getElementById("c-skills-title"),
    cSkillsIntro: document.getElementById("c-skills-intro"),
    cSkillsGroups: document.getElementById("c-skills-groups"),
    cSkillsGroupAdd: document.getElementById("c-skills-group-add"),

    cEducationTitle: document.getElementById("c-education-title"),
    cEducationIntro: document.getElementById("c-education-intro"),
    cEducationItems: document.getElementById("c-education-items"),
    cEducationAdd: document.getElementById("c-education-add"),

    cContactTitle: document.getElementById("c-contact-title"),
    cContactIntro: document.getElementById("c-contact-intro")
  };

  const state = {
    activeTab: "projects",
    projects: {
      data: [],
      fileHandle: null,
      dirty: false,
      source: "blank",
      search: "",
      selectedIndex: -1,
      validation: { errors: [], warnings: [] }
    },
    content: {
      data: ensureContentShape({}),
      fileHandle: null,
      dirty: false,
      source: "blank",
      validation: { errors: [], warnings: [] }
    }
  };

  function setProjectsDirty(dirty) {
    state.projects.dirty = dirty;
    if (dirty) writeProjectsCache(state.projects.data);
  }

  function setProjectsData(projects, source, handle) {
    state.projects.data = Array.isArray(projects) ? projects : [];
    state.projects.source = source;
    state.projects.fileHandle = handle || null;
    state.projects.dirty = false;
    state.projects.search = "";
    state.projects.selectedIndex = state.projects.data.length ? 0 : -1;
    writeProjectsCache(state.projects.data);
  }

  function getSelectedProject() {
    const idx = state.projects.selectedIndex;
    return idx >= 0 && idx < state.projects.data.length ? state.projects.data[idx] : null;
  }

  function uniqueProjectId(base) {
    const taken = new Set(
      state.projects.data
        .filter((p) => isRecord(p) && typeof p.id === "string")
        .map((p) => p.id.trim())
        .filter(Boolean)
    );
    let id = base;
    let n = 2;
    while (!id || taken.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    return id;
  }

  function normalizeTypeValue(value) {
    const t = String(value || "").trim().toLowerCase();
    return t || "other";
  }

  function updateProjectsValidation() {
    state.projects.validation = validateProjects(state.projects.data);
  }

  function renderProjectsStatus(extraMessage) {
    updateProjectsValidation();
    const { errors, warnings } = state.projects.validation;
    const dirty = state.projects.dirty ? "Dirty" : "Saved";
    const src =
      state.projects.source === "site"
        ? "Loaded from site"
        : state.projects.source === "file"
          ? "Loaded from file"
          : state.projects.source === "cache"
            ? "Loaded from sync cache"
            : state.projects.source === "synced"
              ? "Synced from folder"
          : "Not loaded";
    const fs = supportsFileSystemAccess();
    const saveAvailable = Boolean(state.projects.fileHandle) && fs;
    const saveLabel = fs ? (saveAvailable ? "Save enabled" : "Save needs Open file…") : "Save unsupported (download)";
    const parts = [`${src} • ${dirty}`, `Errors: ${errors.length} • Warnings: ${warnings.length}`, saveLabel];
    if (extraMessage) parts.push(extraMessage);
    dom.projectsStatus.textContent = parts.join(" • ");
    dom.projectsSave.disabled = !saveAvailable || errors.length > 0 || !state.projects.dirty;
  }

  function renderProjectIssues() {
    const idx = state.projects.selectedIndex;
    const { errors, warnings } = state.projects.validation;
    const e = errors.filter((it) => it.projectIndex === idx);
    const w = warnings.filter((it) => it.projectIndex === idx);
    const parts = [];
    if (idx === -1) parts.push("Select a project to edit.");
    else parts.push(`Errors: ${e.length} • Warnings: ${w.length}`);
    const first = [...e, ...w].slice(0, 2).map((it) => it.message);
    if (first.length) parts.push(first.join(" • "));
    dom.projectIssues.textContent = parts.join(" • ");
  }

  function renderProjectsControls() {
    const idx = state.projects.selectedIndex;
    const len = state.projects.data.length;
    const has = idx >= 0 && idx < len;
    dom.projectDuplicate.disabled = !has;
    dom.projectDelete.disabled = !has;
    dom.projectUp.disabled = !(has && idx > 0);
    dom.projectDown.disabled = !(has && idx < len - 1);
  }

  function renderProjectsList() {
    const search = state.projects.search.trim().toLowerCase();
    const items = state.projects.data
      .map((p, index) => ({ p, index }))
      .filter(({ p }) => isRecord(p))
      .filter(({ p }) => {
        if (!search) return true;
        const title = readString(p.title).toLowerCase();
        const type = readString(p.type).toLowerCase();
        const tags = ensureArray(p.tags).filter((t) => typeof t === "string").join(" ").toLowerCase();
        return title.includes(search) || type.includes(search) || tags.includes(search);
      });

    dom.projectsList.replaceChildren();
    if (items.length === 0) {
      dom.projectsList.append(makeEl("div", "muted", "No projects match this search."));
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach(({ p, index }) => {
      const btn = makeEl("button", "admin-list-item", "");
      btn.type = "button";
      btn.setAttribute("role", "listitem");
      btn.setAttribute("aria-current", index === state.projects.selectedIndex ? "true" : "false");

      const title = readString(p.title).trim() || "Untitled";
      const type = readString(p.type).trim() || "other";
      const year = readNumber(p.year);
      const featured = Boolean(p.featured);

      btn.append(makeEl("div", "admin-list-title", title));
      const bits = [type];
      if (year) bits.push(String(year));
      if (featured) bits.push("featured");
      btn.append(makeEl("div", "admin-list-meta", bits.join(" • ")));

      btn.addEventListener("click", () => {
        state.projects.selectedIndex = index;
        renderProjects();
      });
      frag.append(btn);
    });
    dom.projectsList.append(frag);
  }

  function setProjectFormEnabled(enabled) {
    const fields = [
      dom.pTitle,
      dom.pId,
      dom.pType,
      dom.pTypeCustom,
      dom.pYear,
      dom.pFeatured,
      dom.pSummary,
      dom.pTagAdd,
      dom.pTagAddBtn,
      dom.pLinkAdd,
      dom.pLinkAddGithub,
      dom.pLinkAddLive,
      dom.pProblem,
      dom.pSolution,
      dom.pRole,
      dom.pHighlightAdd,
      dom.pHighlightAddBtn,
      dom.pThumb,
      dom.pVideoProvider,
      dom.pVideoId,
      dom.pVideoUrl,
      dom.pGalleryAdd,
      dom.pGalleryAddBtn
    ].filter(Boolean);
    fields.forEach((el) => (el.disabled = !enabled));
  }

  function renderProjectTags(project) {
    dom.pTags.replaceChildren();
    const tags = ensureArray(project.tags)
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);

    const frag = document.createDocumentFragment();
    tags.forEach((t, i) => {
      const chip = makeEl("span", "chip admin-chip", t);
      const remove = makeEl("button", "admin-chip-remove", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove tag ${t}`);
      remove.addEventListener("click", () => {
        const p = getSelectedProject();
        if (!p) return;
        const arr = ensureArray(p.tags)
          .filter((x) => typeof x === "string")
          .map((x) => x.trim())
          .filter(Boolean);
        arr.splice(i, 1);
        p.tags = arr;
        setProjectsDirty(true);
        renderProjects();
      });
      chip.append(remove);
      frag.append(chip);
    });
    dom.pTags.append(frag);
  }

  function renderRowList(container, values, onChange, placeholder) {
    container.replaceChildren();
    const frag = document.createDocumentFragment();
    values.forEach((v, i) => {
      const row = makeEl("div", "admin-row", "");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "admin-row-input";
      input.placeholder = placeholder || "";
      input.value = readString(v);
      input.addEventListener("input", () => onChange(i, input.value));

      const remove = makeEl("button", "btn btn-ghost btn-sm", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => onChange(i, null));

      row.append(input, remove);
      frag.append(row);
    });
    container.append(frag);
  }

  function renderLinks(project) {
    const links = ensureArray(project.links).map((l) => (isRecord(l) ? l : { label: "", url: "" }));
    dom.pLinks.replaceChildren();
    const frag = document.createDocumentFragment();
    links.forEach((l, i) => {
      const row = makeEl("div", "admin-row", "");
      const label = document.createElement("input");
      label.type = "text";
      label.className = "admin-row-input";
      label.placeholder = "Label";
      label.value = readString(l.label);
      label.addEventListener("input", () => {
        const p = getSelectedProject();
        if (!p) return;
        if (!Array.isArray(p.links)) p.links = [];
        if (!isRecord(p.links[i])) p.links[i] = {};
        p.links[i].label = label.value;
        setProjectsDirty(true);
        renderProjectsStatus();
        renderProjectIssues();
      });

      const url = document.createElement("input");
      url.type = "text";
      url.className = "admin-row-input";
      url.placeholder = "URL";
      url.value = readString(l.url);
      url.addEventListener("input", () => {
        const p = getSelectedProject();
        if (!p) return;
        if (!Array.isArray(p.links)) p.links = [];
        if (!isRecord(p.links[i])) p.links[i] = {};
        p.links[i].url = url.value;
        setProjectsDirty(true);
        renderProjectsStatus();
        renderProjectIssues();
      });

      const remove = makeEl("button", "btn btn-ghost btn-sm", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => {
        const p = getSelectedProject();
        if (!p) return;
        const arr = ensureArray(p.links).filter((x) => x != null);
        arr.splice(i, 1);
        p.links = arr;
        setProjectsDirty(true);
        renderProjects();
      });

      row.append(label, url, remove);
      frag.append(row);
    });
    dom.pLinks.append(frag);
  }

  function renderProjectHighlights(project) {
    const details = ensureObject(project.details);
    const highlights = ensureArray(details.highlights)
      .filter((h) => typeof h === "string")
      .map((h) => h);
    renderRowList(
      dom.pHighlights,
      highlights,
      (index, value) => {
        const p = getSelectedProject();
        if (!p) return;
        if (!isRecord(p.details)) p.details = {};
        const arr = ensureArray(p.details.highlights)
          .filter((h) => typeof h === "string")
          .map((h) => h);
        if (value === null) {
          arr.splice(index, 1);
          p.details.highlights = arr;
          setProjectsDirty(true);
          renderProjects();
          return;
        }
        arr[index] = value;
        p.details.highlights = arr;
        setProjectsDirty(true);
        renderProjectsStatus();
        renderProjectIssues();
      },
      "Highlight…"
    );
  }

  function renderProjectGallery(project) {
    const media = ensureObject(project.media);
    const gallery = ensureArray(media.gallery)
      .filter((g) => typeof g === "string")
      .map((g) => g);
    renderRowList(
      dom.pGallery,
      gallery,
      (index, value) => {
        const p = getSelectedProject();
        if (!p) return;
        if (!isRecord(p.media)) p.media = {};
        const arr = ensureArray(p.media.gallery)
          .filter((g) => typeof g === "string")
          .map((g) => g);
        if (value === null) {
          arr.splice(index, 1);
          p.media.gallery = arr;
          setProjectsDirty(true);
          renderProjects();
          return;
        }
        arr[index] = value;
        p.media.gallery = arr;
        setProjectsDirty(true);
        renderProjectsStatus();
        renderProjectIssues();
      },
      "assets/projects/..."
    );
  }

  function renderProjectForm() {
    const project = getSelectedProject();
    const has = Boolean(project);
    setProjectFormEnabled(has);

    if (!has) {
      dom.pTitle.value = "";
      dom.pId.value = "";
      dom.pType.value = "website";
      dom.pTypeCustom.value = "";
      dom.pTypeCustom.disabled = true;
      dom.pYear.value = "";
      dom.pFeatured.checked = false;
      dom.pSummary.value = "";
      dom.pTagAdd.value = "";
      dom.pLinks.replaceChildren();
      dom.pTags.replaceChildren();
      dom.pProblem.value = "";
      dom.pSolution.value = "";
      dom.pRole.value = "";
      dom.pHighlights.replaceChildren();
      dom.pThumb.value = "";
      dom.pVideoProvider.value = "";
      dom.pVideoId.value = "";
      dom.pVideoUrl.value = "";
      dom.pGallery.replaceChildren();
      return;
    }

    dom.pTitle.value = readString(project.title);
    dom.pId.value = readString(project.id);

    const type = normalizeTypeValue(project.type);
    const known = ["website", "repo", "python", "app", "tool", "other"];
    if (known.includes(type)) {
      dom.pType.value = type;
      dom.pTypeCustom.value = "";
      dom.pTypeCustom.disabled = true;
    } else {
      dom.pType.value = "custom";
      dom.pTypeCustom.disabled = false;
      dom.pTypeCustom.value = type;
    }

    const year = readNumber(project.year);
    dom.pYear.value = year ? String(year) : "";
    dom.pFeatured.checked = Boolean(project.featured);
    dom.pSummary.value = readString(project.summary);

    renderProjectTags(project);
    renderLinks(project);

    const details = ensureObject(project.details);
    dom.pProblem.value = readString(details.problem);
    dom.pSolution.value = readString(details.solution);
    dom.pRole.value = readString(details.role);
    renderProjectHighlights(project);

    const media = ensureObject(project.media);
    dom.pThumb.value = readString(media.thumbnail);

    const video = isRecord(media.video) ? media.video : null;
    const provider = video && typeof video.provider === "string" ? video.provider.trim().toLowerCase() : "";
    if (provider === "youtube" || provider === "vimeo") dom.pVideoProvider.value = provider;
    else if (provider === "file" || provider === "local") dom.pVideoProvider.value = "file";
    else dom.pVideoProvider.value = "";
    dom.pVideoId.value = video && typeof video.id === "string" ? video.id : "";
    dom.pVideoUrl.value = video && typeof video.url === "string" ? video.url : "";

    renderProjectGallery(project);
  }

  function renderProjects() {
    renderProjectsStatus();
    renderProjectsControls();
    renderProjectsList();
    renderProjectForm();
    renderProjectIssues();
  }

  function setContentDirty(dirty) {
    state.content.dirty = dirty;
  }

  function setContentData(content, source, handle) {
    state.content.data = ensureContentShape(content);
    state.content.source = source;
    state.content.fileHandle = handle || null;
    state.content.dirty = false;
  }

  function updateContentValidation() {
    state.content.validation = validateContent(state.content.data);
  }

  function renderContentStatus(extraMessage) {
    updateContentValidation();
    const { errors, warnings } = state.content.validation;
    const dirty = state.content.dirty ? "Dirty" : "Saved";
    const src =
      state.content.source === "site"
        ? "Loaded from site"
        : state.content.source === "file"
          ? "Loaded from file"
          : "Not loaded";
    const fs = supportsFileSystemAccess();
    const saveAvailable = Boolean(state.content.fileHandle) && fs;
    const saveLabel = fs ? (saveAvailable ? "Save enabled" : "Save needs Open file…") : "Save unsupported (download)";
    const parts = [`${src} • ${dirty}`, `Errors: ${errors.length} • Warnings: ${warnings.length}`, saveLabel];
    if (extraMessage) parts.push(extraMessage);
    dom.contentStatus.textContent = parts.join(" • ");
    dom.contentSave.disabled = !saveAvailable || errors.length > 0 || !state.content.dirty;
  }

  function renderContentIssues() {
    const { errors, warnings } = state.content.validation;
    const parts = [];
    parts.push(`Errors: ${errors.length} • Warnings: ${warnings.length}`);
    const first = [...errors, ...warnings].slice(0, 2).map((it) => it.message);
    if (first.length) parts.push(first.join(" • "));
    dom.contentIssues.textContent = parts.join(" • ");
  }

  function renderContentForm() {
    const c = ensureContentShape(state.content.data);
    state.content.data = c;

    dom.cBirthdate.value = readString(c.birthdateISO);

    const hero = ensureObject(c.hero);
    dom.cHeroEyebrow.value = readString(hero.eyebrow);
    dom.cHeroTitle.value = readString(hero.title);
    dom.cHeroLede.value = readString(hero.lede);
    const heroIllustration = ensureObject(hero.illustration);
    dom.cHeroIllustrationSrc.value = readString(heroIllustration.src);
    dom.cHeroIllustrationAlt.value = readString(heroIllustration.alt);

    const taglines = ensureArray(hero.taglines).filter((t) => typeof t === "string");
    dom.cTaglines.replaceChildren();
    const tFrag = document.createDocumentFragment();
    taglines.forEach((t, i) => {
      const row = makeEl("div", "admin-row", "");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "admin-row-input";
      input.value = t;
      input.addEventListener("input", () => {
        c.hero.taglines[i] = input.value;
        setContentDirty(true);
        renderContentStatus();
        renderContentIssues();
      });
      const remove = makeEl("button", "btn btn-ghost btn-sm", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => {
        c.hero.taglines.splice(i, 1);
        setContentDirty(true);
        renderContent();
      });
      row.append(input, remove);
      tFrag.append(row);
    });
    dom.cTaglines.append(tFrag);

    const cta = ensureArray(hero.cta).map((x) => (isRecord(x) ? x : { label: "", href: "", variant: "secondary" }));
    while (cta.length < 2) cta.push({ label: "", href: "", variant: "secondary" });
    c.hero.cta = cta.slice(0, 2);
    const c0 = c.hero.cta[0];
    const c1 = c.hero.cta[1];
    dom.cCta0Label.value = readString(c0.label);
    dom.cCta0Href.value = readString(c0.href);
    dom.cCta0Variant.value = readString(c0.variant) || "primary";
    dom.cCta1Label.value = readString(c1.label);
    dom.cCta1Href.value = readString(c1.href);
    dom.cCta1Variant.value = readString(c1.variant) || "secondary";

    const qi = ensureObject(hero.quickInfo);
    dom.cQiName.value = readString(qi.name);
    dom.cQiFocus.value = readString(qi.focus);
    dom.cQiSchool.value = readString(qi.school);

    const chips = ensureObject(hero.chips);
    dom.cChipPhoneLabel.value = readString(chips.phoneLabel);
    dom.cChipPhoneHref.value = readString(chips.phoneHref);
    dom.cChipEmailLabel.value = readString(chips.emailLabel);
    dom.cChipEmailHref.value = readString(chips.emailHref);

    const sections = ensureObject(c.sections);
    const about = ensureObject(sections.about);
    dom.cAboutTitle.value = readString(about.title);
    dom.cAboutIntro.value = readString(about.intro);
    const what = ensureObject(about.whatIbuild);
    dom.cAboutWhatTitle.value = readString(what.title);
    dom.cAboutWhatP1.value = readString(what.p1);
    dom.cAboutWhatP2.value = readString(what.p2);
    dom.cAboutWhatMuted.value = readString(what.muted);
    const how = ensureObject(about.howIwork);
    dom.cAboutWorkTitle.value = readString(how.title);

    const bullets = ensureArray(how.bullets).filter((b) => typeof b === "string");
    dom.cAboutWorkBullets.replaceChildren();
    const bFrag = document.createDocumentFragment();
    bullets.forEach((b, i) => {
      const row = makeEl("div", "admin-row", "");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "admin-row-input";
      input.value = b;
      input.addEventListener("input", () => {
        c.sections.about.howIwork.bullets[i] = input.value;
        setContentDirty(true);
        renderContentStatus();
        renderContentIssues();
      });
      const remove = makeEl("button", "btn btn-ghost btn-sm", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => {
        c.sections.about.howIwork.bullets.splice(i, 1);
        setContentDirty(true);
        renderContent();
      });
      row.append(input, remove);
      bFrag.append(row);
    });
    dom.cAboutWorkBullets.append(bFrag);

    const proj = ensureObject(sections.projects);
    dom.cProjectsTitle.value = readString(proj.title);
    dom.cProjectsIntro.value = readString(proj.intro);

    const skills = ensureObject(sections.skills);
    dom.cSkillsTitle.value = readString(skills.title);
    dom.cSkillsIntro.value = readString(skills.intro);
    const groups = ensureArray(skills.groups).map((g) => {
      const gg = isRecord(g) ? g : { title: "", items: [] };
      if (!Array.isArray(gg.items)) gg.items = [];
      return gg;
    });
    c.sections.skills.groups = groups;

    dom.cSkillsGroups.replaceChildren();
    const gFrag = document.createDocumentFragment();
    groups.forEach((g, gi) => {
      const wrap = makeEl("div", "admin-group", "");
      const head = makeEl("div", "admin-group-head", "");
      const title = document.createElement("input");
      title.type = "text";
      title.value = readString(g.title);
      title.placeholder = "Group title";
      title.addEventListener("input", () => {
        c.sections.skills.groups[gi].title = title.value;
        setContentDirty(true);
        renderContentStatus();
        renderContentIssues();
      });
      const del = makeEl("button", "btn btn-ghost btn-sm", "Remove");
      del.type = "button";
      del.addEventListener("click", () => {
        c.sections.skills.groups.splice(gi, 1);
        setContentDirty(true);
        renderContent();
      });
      head.append(title, del);
      wrap.append(head);

      const itemsWrap = makeEl("div", "admin-list-rows", "");
      const items = ensureArray(g.items).filter((it) => typeof it === "string");
      items.forEach((it, ii) => {
        const row = makeEl("div", "admin-row", "");
        const input = document.createElement("input");
        input.type = "text";
        input.className = "admin-row-input";
        input.placeholder = "Item…";
        input.value = it;
        input.addEventListener("input", () => {
          c.sections.skills.groups[gi].items[ii] = input.value;
          setContentDirty(true);
          renderContentStatus();
          renderContentIssues();
        });
        const rm = makeEl("button", "btn btn-ghost btn-sm", "Remove");
        rm.type = "button";
        rm.addEventListener("click", () => {
          c.sections.skills.groups[gi].items.splice(ii, 1);
          setContentDirty(true);
          renderContent();
        });
        row.append(input, rm);
        itemsWrap.append(row);
      });

      const addRow = makeEl("div", "admin-row", "");
      const add = makeEl("button", "btn btn-secondary btn-sm", "Add item");
      add.type = "button";
      add.addEventListener("click", () => {
        c.sections.skills.groups[gi].items.push("");
        setContentDirty(true);
        renderContent();
      });
      addRow.append(add);
      wrap.append(itemsWrap, addRow);
      gFrag.append(wrap);
    });
    dom.cSkillsGroups.append(gFrag);

    const edu = ensureObject(sections.education);
    dom.cEducationTitle.value = readString(edu.title);
    dom.cEducationIntro.value = readString(edu.intro);
    const items = ensureArray(edu.items).map((it) => {
      const e = isRecord(it) ? it : { school: "", role: "", bullets: [] };
      if (!Array.isArray(e.bullets)) e.bullets = [];
      return e;
    });
    c.sections.education.items = items;

    dom.cEducationItems.replaceChildren();
    const eFrag = document.createDocumentFragment();
    items.forEach((it, ei) => {
      const wrap = makeEl("div", "admin-group", "");
      const head = makeEl("div", "admin-group-head", "");
      const school = document.createElement("input");
      school.type = "text";
      school.placeholder = "School";
      school.value = readString(it.school);
      school.addEventListener("input", () => {
        c.sections.education.items[ei].school = school.value;
        setContentDirty(true);
        renderContentStatus();
        renderContentIssues();
      });
      const del = makeEl("button", "btn btn-ghost btn-sm", "Remove");
      del.type = "button";
      del.addEventListener("click", () => {
        c.sections.education.items.splice(ei, 1);
        setContentDirty(true);
        renderContent();
      });
      head.append(school, del);
      wrap.append(head);

      const roleField = makeEl("div", "field", "");
      const roleLabel = makeEl("label", null, "Role");
      const role = document.createElement("input");
      role.type = "text";
      role.value = readString(it.role);
      role.addEventListener("input", () => {
        c.sections.education.items[ei].role = role.value;
        setContentDirty(true);
        renderContentStatus();
        renderContentIssues();
      });
      roleField.append(roleLabel, role);
      wrap.append(roleField);

      const bulletsWrap = makeEl("div", "admin-list-rows", "");
      const blts = ensureArray(it.bullets).filter((b) => typeof b === "string");
      blts.forEach((b, bi) => {
        const row = makeEl("div", "admin-row", "");
        const input = document.createElement("input");
        input.type = "text";
        input.className = "admin-row-input";
        input.placeholder = "Bullet…";
        input.value = b;
        input.addEventListener("input", () => {
          c.sections.education.items[ei].bullets[bi] = input.value;
          setContentDirty(true);
          renderContentStatus();
          renderContentIssues();
        });
        const rm = makeEl("button", "btn btn-ghost btn-sm", "Remove");
        rm.type = "button";
        rm.addEventListener("click", () => {
          c.sections.education.items[ei].bullets.splice(bi, 1);
          setContentDirty(true);
          renderContent();
        });
        row.append(input, rm);
        bulletsWrap.append(row);
      });
      wrap.append(bulletsWrap);

      const addRow = makeEl("div", "admin-row", "");
      const add = makeEl("button", "btn btn-secondary btn-sm", "Add bullet");
      add.type = "button";
      add.addEventListener("click", () => {
        c.sections.education.items[ei].bullets.push("");
        setContentDirty(true);
        renderContent();
      });
      addRow.append(add);
      wrap.append(addRow);

      eFrag.append(wrap);
    });
    dom.cEducationItems.append(eFrag);

    const contact = ensureObject(sections.contact);
    dom.cContactTitle.value = readString(contact.title);
    dom.cContactIntro.value = readString(contact.intro);
  }

  function renderContent() {
    renderContentStatus();
    renderContentForm();
    renderContentIssues();
  }

  function anyDirty() {
    return state.projects.dirty || state.content.dirty;
  }

  window.addEventListener("beforeunload", (event) => {
    if (!anyDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  function setActiveTab(name) {
    state.activeTab = name;
    dom.tabButtons.forEach((btn) => btn.setAttribute("aria-pressed", btn.dataset.tab === name ? "true" : "false"));
    if (dom.tabProjects) dom.tabProjects.hidden = name !== "projects";
    if (dom.tabContent) dom.tabContent.hidden = name !== "content";
  }

  function wireTabs() {
    dom.tabButtons.forEach((btn) =>
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (tab === "projects" || tab === "content") setActiveTab(tab);
      })
    );
  }

  function wireProjectsEditor() {
    const bump = () => {
      setProjectsDirty(true);
      renderProjectsStatus();
      renderProjectIssues();
    };

    dom.projectsSearch.addEventListener("input", () => {
      state.projects.search = dom.projectsSearch.value;
      renderProjectsList();
    });

    if (dom.projectsSyncFolder) {
      dom.projectsSyncFolder.addEventListener("click", async () => {
        if (!supportsDirectoryPicker()) {
          renderProjectsStatus("Folder sync requires a Chromium-based browser that supports showDirectoryPicker().");
          return;
        }

        try {
          renderProjectsStatus(`Select ${DEVS_PATH_HINT} to sync projects...`);
          const dirHandle = await window.showDirectoryPicker();
          const synced = await collectProjectsFromDirectory(dirHandle, state.projects.data);
          if (!synced.length) {
            renderProjectsStatus(`No project folders found in ${dirHandle.name}.`);
            return;
          }

          setProjectsData(synced, "synced", null);
          setProjectsDirty(true);
          renderProjects();
          renderProjectsStatus(`Synced ${synced.length} projects from ${dirHandle.name}.`);
        } catch (err) {
          if (err && err.name === "AbortError") {
            renderProjectsStatus("Folder sync canceled.");
            return;
          }
          renderProjectsStatus("Folder sync failed.");
        }
      });
    }

    dom.projectAdd.addEventListener("click", () => {
      const now = new Date().getFullYear();
      const project = {
        id: uniqueProjectId("new-project"),
        title: "New Project",
        summary: "",
        type: "website",
        year: now,
        tags: [],
        links: [],
        featured: false
      };
      state.projects.data.push(project);
      state.projects.selectedIndex = state.projects.data.length - 1;
      setProjectsDirty(true);
      renderProjects();
    });

    dom.projectDuplicate.addEventListener("click", () => {
      const p = getSelectedProject();
      if (!p) return;
      const clone = JSON.parse(JSON.stringify(p));
      clone.title = `${readString(clone.title).trim() || "Project"} (copy)`;
      clone.id = uniqueProjectId(`${readString(clone.id).trim() || "project"}-copy`);
      state.projects.data.splice(state.projects.selectedIndex + 1, 0, clone);
      state.projects.selectedIndex += 1;
      setProjectsDirty(true);
      renderProjects();
    });

    dom.projectDelete.addEventListener("click", () => {
      const p = getSelectedProject();
      if (!p) return;
      const title = readString(p.title).trim() || "this project";
      if (!window.confirm(`Delete ${title}?`)) return;
      state.projects.data.splice(state.projects.selectedIndex, 1);
      state.projects.selectedIndex = Math.min(state.projects.selectedIndex, state.projects.data.length - 1);
      setProjectsDirty(true);
      renderProjects();
    });

    dom.projectUp.addEventListener("click", () => {
      const i = state.projects.selectedIndex;
      if (i <= 0) return;
      const arr = state.projects.data;
      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      state.projects.selectedIndex = i - 1;
      setProjectsDirty(true);
      renderProjects();
    });

    dom.projectDown.addEventListener("click", () => {
      const i = state.projects.selectedIndex;
      if (i < 0 || i >= state.projects.data.length - 1) return;
      const arr = state.projects.data;
      [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
      state.projects.selectedIndex = i + 1;
      setProjectsDirty(true);
      renderProjects();
    });

    dom.pTitle.addEventListener("input", () => {
      const p = getSelectedProject();
      if (!p) return;
      const oldTitle = readString(p.title);
      const oldSlug = slugify(oldTitle);
      const currentId = readString(p.id).trim();

      p.title = dom.pTitle.value;
      if (!currentId || currentId === oldSlug) {
        const next = slugify(dom.pTitle.value) || uniqueProjectId("project");
        p.id = next;
        dom.pId.value = next;
      }
      bump();
      renderProjectsList();
    });

    dom.pId.addEventListener("input", () => {
      const p = getSelectedProject();
      if (!p) return;
      p.id = dom.pId.value;
      bump();
      renderProjectsList();
    });

    dom.pType.addEventListener("change", () => {
      const p = getSelectedProject();
      if (!p) return;
      if (dom.pType.value === "custom") {
        dom.pTypeCustom.disabled = false;
        p.type = readString(dom.pTypeCustom.value).trim() || "other";
      } else {
        dom.pTypeCustom.disabled = true;
        dom.pTypeCustom.value = "";
        p.type = dom.pType.value;
      }
      bump();
      renderProjectsList();
    });

    dom.pTypeCustom.addEventListener("input", () => {
      const p = getSelectedProject();
      if (!p) return;
      if (dom.pType.value !== "custom") return;
      p.type = readString(dom.pTypeCustom.value).trim() || "other";
      bump();
      renderProjectsList();
    });

    dom.pYear.addEventListener("input", () => {
      const p = getSelectedProject();
      if (!p) return;
      const raw = dom.pYear.value.trim();
      if (!raw) {
        delete p.year;
        bump();
        renderProjectsList();
        return;
      }
      const n = Number(raw);
      if (Number.isFinite(n)) p.year = Math.trunc(n);
      bump();
      renderProjectsList();
    });

    dom.pFeatured.addEventListener("change", () => {
      const p = getSelectedProject();
      if (!p) return;
      p.featured = dom.pFeatured.checked;
      bump();
      renderProjectsList();
    });

    dom.pSummary.addEventListener("input", () => {
      const p = getSelectedProject();
      if (!p) return;
      p.summary = dom.pSummary.value;
      bump();
    });

    const addTag = () => {
      const p = getSelectedProject();
      if (!p) return;
      const value = dom.pTagAdd.value.trim();
      if (!value) return;
      const tags = ensureArray(p.tags)
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean);
      if (!tags.includes(value)) tags.push(value);
      p.tags = tags;
      dom.pTagAdd.value = "";
      setProjectsDirty(true);
      renderProjects();
    };
    dom.pTagAddBtn.addEventListener("click", addTag);
    dom.pTagAdd.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addTag();
    });

    const addLink = (label) => {
      const p = getSelectedProject();
      if (!p) return;
      const links = ensureArray(p.links).filter((l) => l != null);
      links.push({ label: label || "", url: "" });
      p.links = links;
      setProjectsDirty(true);
      renderProjects();
    };
    dom.pLinkAdd.addEventListener("click", () => addLink(""));
    if (dom.pLinkAddGithub) dom.pLinkAddGithub.addEventListener("click", () => addLink("GitHub"));
    if (dom.pLinkAddLive) dom.pLinkAddLive.addEventListener("click", () => addLink("Live Demo"));

    dom.pProblem.addEventListener("input", () => {
      const p = getSelectedProject();
      if (!p) return;
      if (!isRecord(p.details)) p.details = {};
      p.details.problem = dom.pProblem.value;
      bump();
    });

    dom.pSolution.addEventListener("input", () => {
      const p = getSelectedProject();
      if (!p) return;
      if (!isRecord(p.details)) p.details = {};
      p.details.solution = dom.pSolution.value;
      bump();
    });

    dom.pRole.addEventListener("input", () => {
      const p = getSelectedProject();
      if (!p) return;
      if (!isRecord(p.details)) p.details = {};
      p.details.role = dom.pRole.value;
      bump();
    });

    const addHighlight = () => {
      const p = getSelectedProject();
      if (!p) return;
      const value = dom.pHighlightAdd.value.trim();
      if (!value) return;
      if (!isRecord(p.details)) p.details = {};
      const list = ensureArray(p.details.highlights)
        .filter((h) => typeof h === "string")
        .map((h) => h.trim())
        .filter(Boolean);
      list.push(value);
      p.details.highlights = list;
      dom.pHighlightAdd.value = "";
      setProjectsDirty(true);
      renderProjects();
    };
    dom.pHighlightAddBtn.addEventListener("click", addHighlight);
    dom.pHighlightAdd.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addHighlight();
    });

    dom.pThumb.addEventListener("input", () => {
      const p = getSelectedProject();
      if (!p) return;
      if (!isRecord(p.media)) p.media = {};
      p.media.thumbnail = dom.pThumb.value;
      bump();
    });

    const syncVideo = () => {
      const p = getSelectedProject();
      if (!p) return;
      if (!isRecord(p.media)) p.media = {};

      const providerRaw = dom.pVideoProvider.value;
      const id = dom.pVideoId.value.trim();
      const url = dom.pVideoUrl.value.trim();

      if (!providerRaw) {
        delete p.media.video;
        bump();
        return;
      }

      if (providerRaw === "youtube" || providerRaw === "vimeo") {
        p.media.video = { provider: providerRaw, id };
        bump();
        return;
      }

      if (providerRaw === "file") {
        p.media.video = { provider: "file", url };
        bump();
      }
    };
    dom.pVideoProvider.addEventListener("change", syncVideo);
    dom.pVideoId.addEventListener("input", syncVideo);
    dom.pVideoUrl.addEventListener("input", syncVideo);

    const addGallery = () => {
      const p = getSelectedProject();
      if (!p) return;
      const value = dom.pGalleryAdd.value.trim();
      if (!value) return;
      if (!isRecord(p.media)) p.media = {};
      const list = ensureArray(p.media.gallery)
        .filter((g) => typeof g === "string")
        .map((g) => g.trim())
        .filter(Boolean);
      list.push(value);
      p.media.gallery = list;
      dom.pGalleryAdd.value = "";
      setProjectsDirty(true);
      renderProjects();
    };
    dom.pGalleryAddBtn.addEventListener("click", addGallery);
    dom.pGalleryAdd.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      addGallery();
    });
  }

  function wireContentEditor() {
    const bump = () => {
      setContentDirty(true);
      renderContentStatus();
      renderContentIssues();
    };

    const c = () => state.content.data;

    dom.cBirthdate.addEventListener("input", () => {
      c().birthdateISO = dom.cBirthdate.value;
      bump();
    });

    dom.cHeroEyebrow.addEventListener("input", () => {
      c().hero.eyebrow = dom.cHeroEyebrow.value;
      bump();
    });
    dom.cHeroTitle.addEventListener("input", () => {
      c().hero.title = dom.cHeroTitle.value;
      bump();
    });
    dom.cHeroLede.addEventListener("input", () => {
      c().hero.lede = dom.cHeroLede.value;
      bump();
    });
    dom.cHeroIllustrationSrc.addEventListener("input", () => {
      c().hero.illustration.src = dom.cHeroIllustrationSrc.value;
      bump();
    });
    dom.cHeroIllustrationAlt.addEventListener("input", () => {
      c().hero.illustration.alt = dom.cHeroIllustrationAlt.value;
      bump();
    });

    dom.cTaglineAdd.addEventListener("click", () => {
      c().hero.taglines.push("");
      setContentDirty(true);
      renderContent();
    });

    const wireCta = (index, labelEl, hrefEl, variantEl) => {
      labelEl.addEventListener("input", () => {
        c().hero.cta[index].label = labelEl.value;
        bump();
      });
      hrefEl.addEventListener("input", () => {
        c().hero.cta[index].href = hrefEl.value;
        bump();
      });
      variantEl.addEventListener("change", () => {
        c().hero.cta[index].variant = variantEl.value;
        bump();
      });
    };
    wireCta(0, dom.cCta0Label, dom.cCta0Href, dom.cCta0Variant);
    wireCta(1, dom.cCta1Label, dom.cCta1Href, dom.cCta1Variant);

    dom.cQiName.addEventListener("input", () => {
      c().hero.quickInfo.name = dom.cQiName.value;
      bump();
    });
    dom.cQiFocus.addEventListener("input", () => {
      c().hero.quickInfo.focus = dom.cQiFocus.value;
      bump();
    });
    dom.cQiSchool.addEventListener("input", () => {
      c().hero.quickInfo.school = dom.cQiSchool.value;
      bump();
    });

    dom.cChipPhoneLabel.addEventListener("input", () => {
      c().hero.chips.phoneLabel = dom.cChipPhoneLabel.value;
      bump();
    });
    dom.cChipPhoneHref.addEventListener("input", () => {
      c().hero.chips.phoneHref = dom.cChipPhoneHref.value;
      bump();
    });
    dom.cChipEmailLabel.addEventListener("input", () => {
      c().hero.chips.emailLabel = dom.cChipEmailLabel.value;
      bump();
    });
    dom.cChipEmailHref.addEventListener("input", () => {
      c().hero.chips.emailHref = dom.cChipEmailHref.value;
      bump();
    });

    dom.cAboutTitle.addEventListener("input", () => {
      c().sections.about.title = dom.cAboutTitle.value;
      bump();
    });
    dom.cAboutIntro.addEventListener("input", () => {
      c().sections.about.intro = dom.cAboutIntro.value;
      bump();
    });

    dom.cAboutWhatTitle.addEventListener("input", () => {
      c().sections.about.whatIbuild.title = dom.cAboutWhatTitle.value;
      bump();
    });
    dom.cAboutWhatP1.addEventListener("input", () => {
      c().sections.about.whatIbuild.p1 = dom.cAboutWhatP1.value;
      bump();
    });
    dom.cAboutWhatP2.addEventListener("input", () => {
      c().sections.about.whatIbuild.p2 = dom.cAboutWhatP2.value;
      bump();
    });
    dom.cAboutWhatMuted.addEventListener("input", () => {
      c().sections.about.whatIbuild.muted = dom.cAboutWhatMuted.value;
      bump();
    });

    dom.cAboutWorkTitle.addEventListener("input", () => {
      c().sections.about.howIwork.title = dom.cAboutWorkTitle.value;
      bump();
    });
    dom.cAboutWorkAdd.addEventListener("click", () => {
      c().sections.about.howIwork.bullets.push("");
      setContentDirty(true);
      renderContent();
    });

    dom.cProjectsTitle.addEventListener("input", () => {
      c().sections.projects.title = dom.cProjectsTitle.value;
      bump();
    });
    dom.cProjectsIntro.addEventListener("input", () => {
      c().sections.projects.intro = dom.cProjectsIntro.value;
      bump();
    });

    dom.cSkillsTitle.addEventListener("input", () => {
      c().sections.skills.title = dom.cSkillsTitle.value;
      bump();
    });
    dom.cSkillsIntro.addEventListener("input", () => {
      c().sections.skills.intro = dom.cSkillsIntro.value;
      bump();
    });
    dom.cSkillsGroupAdd.addEventListener("click", () => {
      c().sections.skills.groups.push({ title: "", items: [] });
      setContentDirty(true);
      renderContent();
    });

    dom.cEducationTitle.addEventListener("input", () => {
      c().sections.education.title = dom.cEducationTitle.value;
      bump();
    });
    dom.cEducationIntro.addEventListener("input", () => {
      c().sections.education.intro = dom.cEducationIntro.value;
      bump();
    });
    dom.cEducationAdd.addEventListener("click", () => {
      c().sections.education.items.push({ school: "", role: "", bullets: [] });
      setContentDirty(true);
      renderContent();
    });

    dom.cContactTitle.addEventListener("input", () => {
      c().sections.contact.title = dom.cContactTitle.value;
      bump();
    });
    dom.cContactIntro.addEventListener("input", () => {
      c().sections.contact.intro = dom.cContactIntro.value;
      bump();
    });
  }

  function wireFileActions() {
    dom.projectsOpen.addEventListener("click", async () => {
      try {
        const { handle, text } = await openJsonFile();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error("projects.json must be an array");
        setProjectsData(data, "file", handle);
        dom.projectsSearch.value = "";
        renderProjects();
        renderProjectsStatus("Opened file.");
      } catch {
        renderProjectsStatus("Open failed.");
      }
    });

    dom.projectsDownload.addEventListener("click", () => {
      downloadText("projects.json", formatJson(serializeProjects(state.projects.data)));
      renderProjectsStatus("Downloaded.");
    });

    dom.projectsSave.addEventListener("click", async () => {
      const { errors } = state.projects.validation;
      if (errors.length) return;
      if (!state.projects.fileHandle) return;
      try {
        await saveTextToHandle(state.projects.fileHandle, formatJson(serializeProjects(state.projects.data)));
        setProjectsDirty(false);
        renderProjectsStatus("Saved.");
      } catch {
        renderProjectsStatus("Save failed.");
      }
    });

    dom.contentOpen.addEventListener("click", async () => {
      try {
        const { handle, text } = await openJsonFile();
        const data = JSON.parse(text);
        if (!isRecord(data)) throw new Error("content.json must be an object");
        setContentData(data, "file", handle);
        renderContent();
        renderContentStatus("Opened file.");
      } catch {
        renderContentStatus("Open failed.");
      }
    });

    dom.contentDownload.addEventListener("click", () => {
      downloadText("content.json", formatJson(state.content.data));
      renderContentStatus("Downloaded.");
    });

    dom.contentSave.addEventListener("click", async () => {
      const { errors } = state.content.validation;
      if (errors.length) return;
      if (!state.content.fileHandle) return;
      try {
        await saveTextToHandle(state.content.fileHandle, formatJson(state.content.data));
        setContentDirty(false);
        renderContentStatus("Saved.");
      } catch {
        renderContentStatus("Save failed.");
      }
    });
  }

  async function autoLoad() {
    const cachedProjects = readProjectsCache();
    if (Array.isArray(cachedProjects) && cachedProjects.length) {
      setProjectsData(cachedProjects, "cache", null);
    } else {
      try {
        const projects = await tryFetchJson("../projects.json");
        if (!Array.isArray(projects)) throw new Error("projects.json must be an array");
        setProjectsData(projects, "site", null);
      } catch {
        setProjectsData([], "blank", null);
      }
    }

    try {
      const content = await tryFetchJson("../content.json");
      if (!isRecord(content)) throw new Error("content.json must be an object");
      setContentData(content, "site", null);
    } catch {
      setContentData(ensureContentShape({}), "blank", null);
    }
  }

  onReady(async () => {
    const projectForm = document.getElementById("project-form");
    if (projectForm) projectForm.addEventListener("submit", (e) => e.preventDefault());
    const contentForm = document.getElementById("content-form");
    if (contentForm) contentForm.addEventListener("submit", (e) => e.preventDefault());

    wireTabs();
    wireProjectsEditor();
    wireContentEditor();
    wireFileActions();

    await autoLoad();
    setActiveTab("projects");
    renderProjects();
    renderContent();
  });
})();

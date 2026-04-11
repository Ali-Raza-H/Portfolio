
(() => {
  "use strict";

  const CONTENT_URL = "content.json";
  const PROJECTS_URL = "projects.json";
  const PROJECTS_CACHE_KEY = "portfolio.projects.synced.v1";
  const DEFAULT_BIRTHDATE_ISO = "2008-01-23";

  const DEFAULT_TAGLINES = [
    "Learning web development.",
    "Building cool projects.",
    "Designing with creativity.",
    "Eager to grow and learn."
  ];

  const SKILL_ICONS = ["⚙️", "🌐", "🚀", "🎨", "🎬", "🧪", "🛠️", "📦", "💡"];
  const SKILL_LEVEL_PRESETS = {
    html: 96,
    css: 95,
    javascript: 88,
    typescript: 83,
    python: 84,
    java: 74,
    kotlin: 72,
    "c#": 62,
    react: 82,
    figma: 86,
    photoshop: 80,
    illustrator: 76,
    "davinci resolve": 78,
    "premiere pro": 75
  };
  const DOT_CLASSES = ["cyan", "green", "red", "yellow", ""];
  const MODAL_FOCUS_SELECTOR =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  let contentData = null;
  let revealObserver = null;
  let modalController = null;
  let birthdateISO = DEFAULT_BIRTHDATE_ISO;

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function readString(value) {
    return typeof value === "string" ? value : "";
  }

  function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (typeof text === "string") el.textContent = text;
    return el;
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function parseISODate(iso) {
    const trimmed = String(iso || "").trim();
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

  function computeAge(isoDateString) {
    const parsed = parseISODate(isoDateString);
    if (!parsed) return null;

    const now = new Date();
    let age = now.getFullYear() - parsed.year;
    const month = now.getMonth() + 1;
    const day = now.getDate();
    if (month < parsed.month || (month === parsed.month && day < parsed.day)) age -= 1;
    if (age < 0 || age > 130) return null;
    return age;
  }

  function splitDisplayName(name) {
    const trimmed = readString(name).trim();
    if (!trimmed) return ["Your", "Name."];

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return [parts[0], `${parts[0]}.`];

    const tail = parts.pop();
    const head = parts.join(" ");
    const tailWithDot = /[.!?]$/.test(tail) ? tail : `${tail}.`;
    return [head, tailWithDot];
  }

  function safeStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeStorageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = typeof text === "string" ? text : "";
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function loadContent() {
    try {
      const data = await fetchJson(CONTENT_URL);
      return isRecord(data) ? data : null;
    } catch {
      return null;
    }
  }

  function readProjectsCache() {
    const raw = safeStorageGet(PROJECTS_CACHE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async function loadProjects() {
    const cached = readProjectsCache();
    if (Array.isArray(cached) && cached.length) {
      setHint(`Loaded ${cached.length} project${cached.length === 1 ? "" : "s"} from admin sync cache.`);
      return cached;
    }

    try {
      const data = await fetchJson(PROJECTS_URL);
      return Array.isArray(data) ? data : [];
    } catch {
      const isFileProtocol = window.location && window.location.protocol === "file:";
      setHint(
        isFileProtocol
          ? "Projects failed to load. Use a local server (for example VS Code Live Server)."
          : "Projects failed to load."
      );
      return [];
    }
  }

  function normalizeLink(link) {
    if (!isRecord(link)) return null;
    const label = readString(link.label).trim();
    const url = readString(link.url).trim();
    if (!label || !url) return null;
    return { label, url };
  }

  function normalizeProject(rawProject, index) {
    const title = readString(rawProject && rawProject.title).trim();
    const summary = readString(rawProject && rawProject.summary).trim();
    const id = readString(rawProject && rawProject.id).trim() || slugify(title) || `project-${index + 1}`;
    const type = readString(rawProject && rawProject.type).trim().toLowerCase() || "other";
    const year = Number.isInteger(rawProject && rawProject.year) ? rawProject.year : null;
    const featured = Boolean(rawProject && rawProject.featured);

    const tags = Array.isArray(rawProject && rawProject.tags)
      ? rawProject.tags
          .filter((tag) => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    const links = Array.isArray(rawProject && rawProject.links)
      ? rawProject.links.map(normalizeLink).filter(Boolean)
      : [];

    return {
      id,
      title,
      summary,
      type,
      year,
      featured,
      tags,
      links,
      details: isRecord(rawProject && rawProject.details) ? rawProject.details : {},
      media: isRecord(rawProject && rawProject.media) ? rawProject.media : {}
    };
  }

  function typeLabel(type) {
    const key = readString(type).trim().toLowerCase();
    if (!key) return "Other";
    if (key === "repo") return "Repo";
    if (key === "python") return "Python";
    if (key === "website") return "Website";
    if (key === "tool") return "Tool";
    if (key === "app") return "App";
    return `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  }

  function classifyLink(link) {
    const label = readString(link.label).toLowerCase();
    const url = readString(link.url).toLowerCase();
    if (label.includes("github") || label.includes("repo") || url.includes("github.com")) return "is-github";
    if (label.includes("live") || label.includes("demo") || label.includes("site")) return "is-live";
    return "is-other";
  }

  function setHint(text) {
    setText("projects-hint", readString(text));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function inferSkillPercent(skillName, index) {
    const key = readString(skillName).trim().toLowerCase();
    if (key && Object.prototype.hasOwnProperty.call(SKILL_LEVEL_PRESETS, key)) {
      return SKILL_LEVEL_PRESETS[key];
    }
    return clamp(78 - index * 5, 42, 92);
  }

  function skillRankLabel(percent) {
    if (percent >= 92) return "Max level";
    if (percent >= 84) return "Champion";
    if (percent >= 76) return "Diamond";
    if (percent >= 68) return "Platinum";
    if (percent >= 58) return "Gold";
    return "Silver";
  }

  function inferProjectStatus(project) {
    const hasLive = project.links.some((link) => classifyLink(link) === "is-live");
    if (hasLive) return { text: "Completed", className: "" };
    if (project.featured) return { text: "In Progress", className: "is-progress" };
    return { text: "Planned", className: "is-progress" };
  }

  function inferComplexity(project) {
    const tagScore = clamp(project.tags.length, 0, 4);
    const highlights = Array.isArray(project.details && project.details.highlights) ? project.details.highlights.length : 0;
    const links = project.links.length > 0 ? 1 : 0;
    const typeBonus = project.type === "app" || project.type === "python" ? 1 : 0;
    const base = 1 + Math.round((tagScore + highlights * 0.35 + links + typeBonus) / 2);
    return clamp(base, 1, 5);
  }

  function stars(level) {
    return `${"✦".repeat(level)}${"✧".repeat(Math.max(0, 5 - level))}`;
  }

  function observeReveal(element) {
    if (!element) return;
    if (!revealObserver || prefersReducedMotion()) {
      element.classList.add("visible");
      return;
    }
    revealObserver.observe(element);
  }

  function initRevealObserver() {
    if (prefersReducedMotion()) {
      document.querySelectorAll(".reveal").forEach((element) => element.classList.add("visible"));
      return;
    }

    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );

    document.querySelectorAll(".reveal").forEach(observeReveal);
  }

  function initShapeCanvas() {
    const canvas = document.getElementById("shape-canvas");
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reduced = prefersReducedMotion();
    const maxDepth = 320;
    const focal = 520;
    const baseCubeVertices = [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1]
    ];
    const cubeEdges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7]
    ];

    const phi = (1 + Math.sqrt(5)) / 2;
    const baseIcoVertices = [
      [-1, phi, 0],
      [1, phi, 0],
      [-1, -phi, 0],
      [1, -phi, 0],
      [0, -1, phi],
      [0, 1, phi],
      [0, -1, -phi],
      [0, 1, -phi],
      [phi, 0, -1],
      [phi, 0, 1],
      [-phi, 0, -1],
      [-phi, 0, 1]
    ];
    const icoEdges = [
      [0, 1], [0, 5], [0, 7], [0, 10], [0, 11],
      [1, 5], [1, 7], [1, 8], [1, 9],
      [2, 3], [2, 4], [2, 6], [2, 10], [2, 11],
      [3, 4], [3, 6], [3, 8], [3, 9],
      [4, 5], [4, 9], [4, 11],
      [5, 9], [5, 11],
      [6, 7], [6, 8], [6, 10],
      [7, 8], [7, 10],
      [8, 9], [10, 11]
    ];

    let width = 0;
    let height = 0;
    let animationHandle = 0;
    let shapes = [];

    const shapeCount = reduced ? 8 : 26;

    function rotatePoint(vertex, rx, ry, rz) {
      const [x0, y0, z0] = vertex;

      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const y1 = y0 * cosX - z0 * sinX;
      const z1 = y0 * sinX + z0 * cosX;

      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const x2 = x0 * cosY + z1 * sinY;
      const z2 = -x0 * sinY + z1 * cosY;

      const cosZ = Math.cos(rz);
      const sinZ = Math.sin(rz);
      const x3 = x2 * cosZ - y1 * sinZ;
      const y3 = x2 * sinZ + y1 * cosZ;

      return [x3, y3, z2];
    }

    function projectPoint(point, shape) {
      const px = point[0] * shape.size;
      const py = point[1] * shape.size;
      const pz = point[2] * shape.size + shape.z;
      const depthScale = focal / (focal + pz);
      return {
        x: shape.x + px * depthScale,
        y: shape.y + py * depthScale,
        z: pz,
        scale: depthScale
      };
    }

    function buildShape(index) {
      const type = index % 3 === 0 ? "ico" : "cube";
      return {
        type,
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * maxDepth - maxDepth * 0.5,
        size: type === "ico" ? 22 + Math.random() * 26 : 26 + Math.random() * 34,
        driftX: (Math.random() - 0.5) * (reduced ? 0.08 : 0.22),
        driftY: (Math.random() - 0.5) * (reduced ? 0.08 : 0.22),
        driftZ: (Math.random() - 0.5) * (reduced ? 0.03 : 0.1),
        rx: Math.random() * Math.PI * 2,
        ry: Math.random() * Math.PI * 2,
        rz: Math.random() * Math.PI * 2,
        spinX: (Math.random() - 0.5) * (reduced ? 0.002 : 0.008),
        spinY: (Math.random() - 0.5) * (reduced ? 0.002 : 0.008),
        spinZ: (Math.random() - 0.5) * (reduced ? 0.002 : 0.008),
        color: Math.random() > 0.45 ? "124,106,247" : "86,207,225"
      };
    }

    function createShapes() {
      shapes = Array.from({ length: shapeCount }, (_, index) => buildShape(index));
    }

    function resizeCanvas() {
      if (animationHandle) {
        window.cancelAnimationFrame(animationHandle);
        animationHandle = 0;
      }

      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      createShapes();
      if (reduced) {
        drawFrame();
      } else {
        animationHandle = window.requestAnimationFrame(drawFrame);
      }
    }

    function drawShape(shape) {
      const vertices = shape.type === "ico" ? baseIcoVertices : baseCubeVertices;
      const edges = shape.type === "ico" ? icoEdges : cubeEdges;
      const projected = vertices.map((vertex) => projectPoint(rotatePoint(vertex, shape.rx, shape.ry, shape.rz), shape));
      const alpha = clamp(0.08 + (1 - (shape.z + maxDepth * 0.5) / maxDepth) * 0.18, 0.06, 0.28);

      context.strokeStyle = `rgba(${shape.color}, ${alpha.toFixed(3)})`;
      context.lineWidth = 1.2;
      context.beginPath();
      edges.forEach(([from, to]) => {
        const a = projected[from];
        const b = projected[to];
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
      });
      context.stroke();
    }

    function updateShape(shape) {
      shape.x += shape.driftX;
      shape.y += shape.driftY;
      shape.z += shape.driftZ;
      shape.rx += shape.spinX;
      shape.ry += shape.spinY;
      shape.rz += shape.spinZ;

      const limit = 120;
      if (shape.x < -limit) shape.x = width + limit;
      if (shape.x > width + limit) shape.x = -limit;
      if (shape.y < -limit) shape.y = height + limit;
      if (shape.y > height + limit) shape.y = -limit;
      if (shape.z < -maxDepth * 0.8) shape.z = maxDepth * 0.65;
      if (shape.z > maxDepth * 0.8) shape.z = -maxDepth * 0.55;
    }

    function drawFrame() {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(4, 6, 10, 0.58)";
      context.fillRect(0, 0, width, height);

      shapes.forEach((shape) => {
        if (!reduced) updateShape(shape);
        drawShape(shape);
      });

      if (!reduced) animationHandle = window.requestAnimationFrame(drawFrame);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
  }

  function makeButtonLink(label, href, className) {
    const anchor = makeEl("a", className, label);
    anchor.href = href;
    return anchor;
  }

  function renderHero(content) {
    const hero = isRecord(content && content.hero) ? content.hero : {};
    const quick = isRecord(hero.quickInfo) ? hero.quickInfo : {};

    const displayName = readString(quick.name).trim() || "Ali Raza";
    const [line1, line2] = splitDisplayName(displayName);
    setText("hero-name-line1", line1);
    setText("hero-name-line2", line2);

    setText("hero-eyebrow", readString(hero.eyebrow).trim() || "available for work & collabs");
    setText("hero-title", readString(hero.title).trim() || "Building clean, fast, and memorable web experiences.");
    setText("hero-lede", readString(hero.lede).trim() || "I build things for the web, design experiences, and polish every detail.");

    const focus = readString(quick.focus).trim() || "web dev + design";
    const school = readString(quick.school).trim() || "Sixth Form Bolton";
    setText("hero-focus-cmd", ` cat ${focus.toLowerCase().replace(/\s+/g, "_")}.txt`);
    setText("hero-focus-seg", `focus: ${focus}`);
    setText("hero-school-seg", `school: ${school}`);

    renderHeroIllustration(hero);
    renderHeroCtas(hero);
  }

  function renderHeroIllustration(hero) {
    const image = document.getElementById("hero-portrait");
    const placeholder = document.getElementById("hero-portrait-placeholder");
    if (!image || !placeholder) return;

    const illustration = isRecord(hero && hero.illustration) ? hero.illustration : {};
    const src = readString(illustration.src).trim();
    const alt = readString(illustration.alt).trim() || "Hero illustration";

    if (!src) {
      image.hidden = true;
      image.removeAttribute("src");
      image.alt = alt;
      placeholder.hidden = false;
      return;
    }

    image.alt = alt;
    image.src = src;
    image.hidden = false;
    placeholder.hidden = true;

    image.addEventListener(
      "error",
      () => {
        image.hidden = true;
        placeholder.hidden = false;
      },
      { once: true }
    );
  }

  function renderHeroCtas(hero) {
    const root = document.getElementById("hero-cta");
    if (!root) return;

    const ctas = Array.isArray(hero && hero.cta)
      ? hero.cta
          .filter((cta) => isRecord(cta))
          .map((cta) => ({
            label: readString(cta.label).trim(),
            href: readString(cta.href).trim(),
            variant: readString(cta.variant).trim().toLowerCase()
          }))
          .filter((cta) => cta.label && cta.href)
      : [];

    root.replaceChildren();

    if (!ctas.length) {
      root.append(makeButtonLink("view projects ↓", "#projects", "btn btn-primary"));
      root.append(makeButtonLink("get in touch", "#contact", "btn btn-ghost"));
      return;
    }

    ctas.slice(0, 3).forEach((cta, index) => {
      const className =
        cta.variant === "primary"
          ? "btn btn-primary"
          : cta.variant === "ghost"
            ? "btn btn-ghost"
            : index === 0
              ? "btn btn-primary"
              : "btn btn-ghost";
      root.append(makeButtonLink(cta.label, cta.href, className));
    });
  }

  function renderInfoList(containerId, items) {
    const root = document.getElementById(containerId);
    if (!root) return;

    root.replaceChildren();
    const fragment = document.createDocumentFragment();

    items.slice(0, 8).forEach((item, index) => {
      const row = makeEl("div", "info-item");
      const dotClass = DOT_CLASSES[index % DOT_CLASSES.length];
      const dot = makeEl("div", dotClass ? `info-dot ${dotClass}` : "info-dot");
      row.append(dot, document.createTextNode(item));
      fragment.append(row);
    });

    root.append(fragment);
  }

  function renderAbout(content, ageValue) {
    const about = isRecord(content && content.sections && content.sections.about) ? content.sections.about : {};
    const what = isRecord(about.whatIbuild) ? about.whatIbuild : {};

    setText("about-title", readString(about.title).trim() || "about_me");
    setText("about-intro", readString(about.intro).trim() || "I am a student developer who blends creativity with practical engineering.");
    setText("about-what-p1", readString(what.p1).trim() || "I build responsive websites, tools, and prototypes with clean design systems.");
    setText("about-what-muted", readString(what.muted).trim() || "I am always improving my JavaScript fundamentals and shipping better projects.");

    const second = readString(what.p2).trim();
    const secondElement = document.getElementById("about-what-p2");
    if (secondElement) {
      if (second) {
        secondElement.hidden = false;
        secondElement.textContent = second;
      } else {
        secondElement.hidden = true;
        secondElement.textContent = "";
      }
    }

    const work = isRecord(about.howIwork) ? about.howIwork : {};
    setText("about-work-title", readString(work.title).trim() || "// how_i_work");

    const bullets = Array.isArray(work.bullets)
      ? work.bullets
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
    renderInfoList("about-work-list", bullets.length ? bullets : ["Design-first thinking", "Mobile-first layouts"]);

    const hero = isRecord(content && content.hero) ? content.hero : {};
    const quick = isRecord(hero.quickInfo) ? hero.quickInfo : {};
    const quickItems = [];
    const focus = readString(quick.focus).trim();
    const school = readString(quick.school).trim();
    if (focus) quickItems.push(`Focus: ${focus}`);
    if (school) quickItems.push(`School: ${school}`);
    if (Number.isInteger(ageValue)) quickItems.push(`Age: ${ageValue}`);
    renderInfoList("about-quick-list", quickItems.length ? quickItems : ["Always shipping new work"]);

    const chips = isRecord(hero.chips) ? hero.chips : {};
    const contactItems = [];
    const email = readString(chips.emailLabel).trim();
    const phone = readString(chips.phoneLabel).trim();
    if (email) contactItems.push(email);
    if (phone) contactItems.push(phone);
    renderInfoList("about-contact-list", contactItems.length ? contactItems : ["Open to collaboration"]);
  }

  function renderSkills(content) {
    const skills = isRecord(content && content.sections && content.sections.skills) ? content.sections.skills : {};
    const groupsRoot = document.getElementById("skills-groups");
    const barsRoot = document.getElementById("skills-bars");
    if (!groupsRoot || !barsRoot) return;

    setText("skills-title", readString(skills.title).trim() || "skills.txt");
    setText("skills-intro", readString(skills.intro).trim() || "Languages, frontend, and creative tools I use to ship work.");

    const groups = Array.isArray(skills.groups)
      ? skills.groups
          .filter((group) => isRecord(group))
          .map((group) => ({
            title: readString(group.title).trim(),
            items: Array.isArray(group.items)
              ? group.items
                  .filter((item) => typeof item === "string")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : []
          }))
          .filter((group) => group.title)
      : [];

    groupsRoot.replaceChildren();
    barsRoot.replaceChildren();

    if (!groups.length) {
      const card = makeEl("div", "skill-card reveal");
      card.append(makeEl("div", "skill-icon", "⚙️"));
      card.append(makeEl("div", "skill-title", "Skills"));
      card.append(makeEl("div", "skill-desc", "Add skill groups from content.json or the admin panel."));
      groupsRoot.append(card);
      observeReveal(card);

      const heading = makeEl("div", "skills-bars-title", "Current loadout");
      const empty = makeEl("div", "skills-bars-empty", "Skill bars will appear here once skills are added.");
      barsRoot.append(heading, empty);
      observeReveal(barsRoot);
      return;
    }

    const fragment = document.createDocumentFragment();
    const barItems = [];

    groups.slice(0, 9).forEach((group, index) => {
      const card = makeEl("div", "skill-card reveal");
      card.append(makeEl("div", "skill-icon", SKILL_ICONS[index % SKILL_ICONS.length]));
      card.append(makeEl("div", "skill-title", group.title));

      const description =
        group.items.length > 0
          ? `Using ${group.items.slice(0, 4).join(", ")} to build and ship polished work.`
          : "Skill set in progress.";

      card.append(makeEl("div", "skill-desc", description));

      const tags = makeEl("div", "skill-tags");
      group.items.slice(0, 8).forEach((item) => tags.append(makeEl("span", "tag", item)));
      card.append(tags);
      fragment.append(card);

      group.items.forEach((item) => {
        if (barItems.length >= 12) return;
        barItems.push(item);
      });
    });

    groupsRoot.append(fragment);

    const heading = makeEl("div", "skills-bars-title", "Current loadout");
    barsRoot.append(heading);

    if (!barItems.length) {
      barsRoot.append(makeEl("div", "skills-bars-empty", "Add skill items to display ranked bars."));
    } else {
      const used = new Set();
      barItems.forEach((item, index) => {
        const key = readString(item).trim().toLowerCase();
        if (!key || used.has(key)) return;
        used.add(key);

        const percent = inferSkillPercent(item, index);
        const barItem = makeEl("div", "skill-bar-item");
        const head = makeEl("div", "skill-bar-head");
        head.append(makeEl("span", "skill-bar-label", item));
        head.append(makeEl("span", "skill-bar-rank", `${skillRankLabel(percent)} • ${percent}%`));

        const track = makeEl("div", "skill-bar-track");
        const fill = makeEl("div", "skill-bar-fill");
        fill.style.width = `${percent}%`;
        track.append(fill);
        barItem.append(head, track);
        barsRoot.append(barItem);
      });
    }

    groupsRoot.querySelectorAll(".reveal").forEach(observeReveal);
    observeReveal(barsRoot);
  }

  function renderContact(content) {
    const contact = isRecord(content && content.sections && content.sections.contact) ? content.sections.contact : {};
    setText("contact-title", readString(contact.title).trim() || "contact.sh");
    setText("contact-intro", readString(contact.intro).trim() || "Feel free to reach out for collaborations, questions, or just to say hi.");

    const hero = isRecord(content && content.hero) ? content.hero : {};
    const chips = isRecord(hero.chips) ? hero.chips : {};

    const links = [];
    const emailLabel = readString(chips.emailLabel).trim();
    const emailHref = readString(chips.emailHref).trim();
    const phoneLabel = readString(chips.phoneLabel).trim();
    const phoneHref = readString(chips.phoneHref).trim();

    if (emailLabel && emailHref) links.push({ icon: "✉", label: emailLabel, href: emailHref });
    if (phoneLabel && phoneHref) links.push({ icon: "☎", label: phoneLabel, href: phoneHref });

    const root = document.getElementById("contact-links");
    if (!root || !links.length) return;

    root.replaceChildren();
    links.forEach((link) => {
      const anchor = makeEl("a", "contact-link");
      anchor.href = link.href;
      if (/^https?:/i.test(link.href)) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }

      anchor.append(makeEl("span", "contact-link-icon", link.icon));
      anchor.append(makeEl("span", "contact-link-label", link.label));
      anchor.append(makeEl("span", "contact-link-arrow", "↗"));
      root.append(anchor);
    });
  }

  function renderProjects(projects) {
    const root = document.getElementById("projects-list");
    if (!root) return;

    const normalized = projects
      .map((project, index) => normalizeProject(project, index))
      .filter((project) => project.title);

    setText(
      "projects-title",
      readString(contentData && contentData.sections && contentData.sections.projects && contentData.sections.projects.title) ||
        "projects/"
    );
    setText(
      "projects-intro",
      readString(contentData && contentData.sections && contentData.sections.projects && contentData.sections.projects.intro) ||
        "Projects synced from your development workspace."
    );

    setHint(`${normalized.length} project${normalized.length === 1 ? "" : "s"}`);
    root.replaceChildren();

    if (!normalized.length) {
      const empty = makeEl("div", "project-empty", "No projects found. Use the admin panel to sync from your Devs folder.");
      root.append(empty);
      observeReveal(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    normalized.forEach((project, index) => {
      const item = makeEl("a", "quest-card reveal");
      item.href = "#";
      item.dataset.projectId = project.id;

      const status = inferProjectStatus(project);
      const complexity = inferComplexity(project);

      const header = makeEl("div", "quest-header");
      header.append(makeEl("h3", "quest-title", `${String(index + 1).padStart(2, "0")} • ${project.title}`));
      const badgeClass = status.className ? `quest-status ${status.className}` : "quest-status";
      header.append(makeEl("span", badgeClass, status.text));
      item.append(header);

      item.append(makeEl("p", "quest-desc", project.summary || "No summary provided yet."));

      const meta = makeEl("div", "quest-meta");
      const complexityEl = makeEl("div", "complexity", stars(complexity));
      complexityEl.title = `Complexity ${complexity}/5`;
      meta.append(complexityEl);

      const stack = makeEl("div", "tech-stack");
      stack.append(makeEl("span", "tech-pill", typeLabel(project.type)));
      if (project.year) stack.append(makeEl("span", "tech-pill", String(project.year)));
      project.tags.slice(0, 3).forEach((tag) => stack.append(makeEl("span", "tech-pill", tag)));
      meta.append(stack);
      item.append(meta);

      item.addEventListener("click", (event) => {
        event.preventDefault();
        if (modalController) modalController.open(project, item);
      });

      fragment.append(item);
    });

    root.append(fragment);
    root.querySelectorAll(".reveal").forEach(observeReveal);
  }

  function getFocusable(container) {
    return Array.from(container.querySelectorAll(MODAL_FOCUS_SELECTOR)).filter((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function initProjectModal() {
    const modal = document.getElementById("project-modal");
    const dialog = modal ? modal.querySelector(".project-modal-dialog") : null;
    if (!modal || !dialog) return null;

    const typeElement = document.getElementById("modal-type");
    const titleElement = document.getElementById("modal-title");
    const metaElement = document.getElementById("modal-meta");
    const summaryElement = document.getElementById("modal-summary");
    const linksElement = document.getElementById("modal-links");
    const sectionsElement = document.getElementById("modal-sections");
    const galleryElement = document.getElementById("modal-gallery");

    let lastActiveElement = null;

    function close() {
      modal.classList.remove("is-open");
      modal.classList.remove("is-opening");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";

      document.removeEventListener("keydown", onKeyDown);
      modal.removeEventListener("click", onOverlayClick);

      if (lastActiveElement && typeof lastActiveElement.focus === "function") {
        lastActiveElement.focus();
      }
      lastActiveElement = null;
    }

    function onOverlayClick(event) {
      const target = event.target;
      if (!target || !target.closest) return;
      if (target.closest("[data-modal-close]")) close();
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusable(dialog);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    }

    function renderLinks(project) {
      linksElement.replaceChildren();
      project.links.forEach((link) => {
        const anchor = makeEl("a", `project-modal-link ${classifyLink(link)}`, link.label);
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        linksElement.append(anchor);
      });
    }

    function renderSections(project) {
      sectionsElement.replaceChildren();
      const details = isRecord(project.details) ? project.details : {};
      const rows = [];

      const problem = readString(details.problem).trim();
      const solution = readString(details.solution).trim();
      const role = readString(details.role).trim();
      if (problem) rows.push({ heading: "Problem", body: problem });
      if (solution) rows.push({ heading: "Solution", body: solution });
      if (role) rows.push({ heading: "Role", body: role });

      rows.forEach((row) => {
        const section = makeEl("div", "project-modal-section");
        section.append(makeEl("h4", null, row.heading));
        section.append(makeEl("p", null, row.body));
        sectionsElement.append(section);
      });

      const highlights = Array.isArray(details.highlights)
        ? details.highlights
            .filter((item) => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

      if (highlights.length) {
        const section = makeEl("div", "project-modal-section");
        section.append(makeEl("h4", null, "Highlights"));
        const list = document.createElement("ul");
        highlights.slice(0, 8).forEach((item) => list.append(makeEl("li", null, item)));
        section.append(list);
        sectionsElement.append(section);
      }

      if (!rows.length && !highlights.length) {
        sectionsElement.append(
          makeEl(
            "div",
            "project-modal-section",
            "Add project details from the admin panel to show problem, solution, role, and highlights here."
          )
        );
      }
    }

    function renderGallery(project) {
      galleryElement.replaceChildren();
      const media = isRecord(project.media) ? project.media : {};

      const thumbnail = readString(media.thumbnail).trim();
      if (thumbnail) {
        const image = document.createElement("img");
        image.loading = "lazy";
        image.src = thumbnail;
        image.alt = `${project.title} thumbnail`;
        galleryElement.append(image);
      }

      if (isRecord(media.video)) {
        const provider = readString(media.video.provider).trim().toLowerCase();
        const id = readString(media.video.id).trim();
        const url = readString(media.video.url).trim();

        if ((provider === "youtube" || provider === "vimeo") && id) {
          const iframe = document.createElement("iframe");
          iframe.loading = "lazy";
          iframe.allow =
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
          iframe.allowFullscreen = true;
          iframe.title = `${project.title} video`;
          iframe.src =
            provider === "youtube"
              ? `https://www.youtube.com/embed/${encodeURIComponent(id)}`
              : `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
          galleryElement.append(iframe);
        }

        if ((provider === "file" || provider === "local") && url) {
          const video = document.createElement("video");
          video.controls = true;
          video.preload = "metadata";
          video.playsInline = true;
          video.src = url;
          video.title = `${project.title} video`;
          galleryElement.append(video);
        }
      }

      if (Array.isArray(media.gallery)) {
        media.gallery
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
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
              video.title = `${project.title} media`;
              galleryElement.append(video);
              return;
            }

            const image = document.createElement("img");
            image.loading = "lazy";
            image.src = src;
            image.alt = `${project.title} screenshot`;
            galleryElement.append(image);
          });
      }
    }

    function open(project, trigger) {
      lastActiveElement = trigger || document.activeElement;

      typeElement.textContent = typeLabel(project.type).toLowerCase();
      titleElement.textContent = project.title || "Project";

      metaElement.replaceChildren();
      if (project.year) metaElement.append(makeEl("span", null, String(project.year)));
      project.tags.slice(0, 6).forEach((tag) => metaElement.append(makeEl("span", null, `#${tag}`)));

      summaryElement.textContent =
        project.summary || "Open the admin panel and add a summary so this section describes the project.";

      renderLinks(project);
      renderSections(project);
      renderGallery(project);

      modal.classList.add("is-open");
      modal.classList.remove("is-opening");
      window.setTimeout(() => {
        if (modal.classList.contains("is-open")) modal.classList.add("is-opening");
      }, 20);
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      modal.addEventListener("click", onOverlayClick);
      document.addEventListener("keydown", onKeyDown);
      dialog.focus();
    }

    return { open, close };
  }

  function initWaybar() {
    const sectionIds = ["hero", "about", "skills", "projects", "contact"];
    const dots = Array.from(document.querySelectorAll(".waybar-ws"));

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        const target = document.getElementById(sectionIds[index]);
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = sectionIds.indexOf(entry.target.id);
          if (index === -1) return;
          dots.forEach((dot) => dot.classList.remove("active"));
          if (dots[index]) dots[index].classList.add("active");
        });
      },
      { threshold: 0.45 }
    );

    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  function initClock() {
    const clock = document.getElementById("clock");
    if (!clock) return;

    const updateClock = () => {
      clock.textContent = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    };

    updateClock();
    window.setInterval(updateClock, 1000);
  }

  function initCursor() {
    const cursor = document.getElementById("cursor");
    const ring = document.getElementById("cursor-ring");
    if (!cursor || !ring) return;
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    let scale = 1;

    document.addEventListener("mousemove", (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
    });

    const animate = () => {
      cursor.style.transform = `translate(${mouseX - 5}px, ${mouseY - 5}px) scale(${scale})`;
      ringX += (mouseX - ringX) * 0.14;
      ringY += (mouseY - ringY) * 0.14;
      ring.style.transform = `translate(${ringX - 16}px, ${ringY - 16}px)`;
      requestAnimationFrame(animate);
    };
    animate();

    document.querySelectorAll("a, button, .waybar-ws").forEach((element) => {
      element.addEventListener("mouseenter", () => {
        scale = 2;
        ring.style.opacity = "0.8";
      });
      element.addEventListener("mouseleave", () => {
        scale = 1;
        ring.style.opacity = "0.4";
      });
    });
  }

  function initKonami() {
    const sequence = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    let history = [];

    document.addEventListener("keydown", (event) => {
      history.push(event.keyCode);
      history = history.slice(-sequence.length);
      if (history.join(",") !== sequence.join(",")) return;

      document.body.style.setProperty("--accent", "#f97316");
      document.body.style.setProperty("--accent2", "#fbbf24");

      const note = document.createElement("div");
      note.style.cssText =
        "position:fixed;bottom:24px;right:24px;background:#f97316;color:#fff;padding:10px 16px;border-radius:6px;font-family:var(--font-mono);font-size:12px;z-index:9999;";
      note.textContent = "Boost mode enabled";
      document.body.append(note);
      window.setTimeout(() => note.remove(), 2400);
    });
  }

  function initFooterYear() {
    setText("year", String(new Date().getFullYear()));
  }

  function renderAge() {
    const age = computeAge(birthdateISO);
    setText("age", Number.isInteger(age) ? String(age) : "-");
    return Number.isInteger(age) ? age : null;
  }

  function initRotatingPrompt(lines) {
    const command = document.getElementById("hero-focus-cmd");
    if (!command || !Array.isArray(lines) || !lines.length) return;
    if (prefersReducedMotion()) return;

    let index = 0;
    window.setInterval(() => {
      index = (index + 1) % lines.length;
      command.textContent = ` cat "${lines[index]}"`;
    }, 3200);
  }

  function applyContentData(data) {
    contentData = isRecord(data) ? data : {};
    const fromContent = readString(contentData.birthdateISO).trim();
    birthdateISO = parseISODate(fromContent) ? fromContent : DEFAULT_BIRTHDATE_ISO;

    const age = renderAge();
    renderHero(contentData);
    renderAbout(contentData, age);
    renderSkills(contentData);
    renderContact(contentData);

    const hero = isRecord(contentData.hero) ? contentData.hero : {};
    const taglines = Array.isArray(hero.taglines)
      ? hero.taglines
          .filter((line) => typeof line === "string")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

    initRotatingPrompt(taglines.length ? taglines : DEFAULT_TAGLINES);
  }

  async function bootstrap() {
    initShapeCanvas();
    initClock();
    initCursor();
    initRevealObserver();
    initWaybar();
    initKonami();
    initFooterYear();

    modalController = initProjectModal();

    const loadedContent = await loadContent();
    applyContentData(loadedContent || {});

    const loadedProjects = await loadProjects();
    renderProjects(Array.isArray(loadedProjects) ? loadedProjects : []);
  }

  onReady(bootstrap);

  window.addEventListener("storage", (event) => {
    if (event.key !== PROJECTS_CACHE_KEY) return;

    if (!event.newValue) {
      safeStorageRemove(PROJECTS_CACHE_KEY);
      return;
    }

    try {
      const parsed = JSON.parse(event.newValue);
      if (!Array.isArray(parsed)) return;
      renderProjects(parsed);
      setHint(`Loaded ${parsed.length} project${parsed.length === 1 ? "" : "s"} from admin sync cache.`);
    } catch {
      // ignore invalid cache updates
    }
  });
})();

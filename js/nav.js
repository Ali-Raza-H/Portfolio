document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".site-nav");
  const hamburger = document.querySelector(".hamburger");
  const progress = document.querySelector(".nav-progress");
  const links = document.querySelectorAll(".nav-links a");

  if (!nav) return;

  nav.classList.add("nav-ready");

  const SCROLL_THRESHOLD = 60;

  const updateOnScroll = () => {
    // Solid navbar once the page has scrolled past the threshold.
    nav.classList.toggle("scrolled", window.scrollY > SCROLL_THRESHOLD);

    // Progress bar spans the whole document height.
    if (progress) {
      const scrollable = document.documentElement.scrollHeight -
        window.innerHeight;
      const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      progress.style.transform = `scaleX(${Math.min(ratio, 1)})`;
    }
  };

  updateOnScroll();
  window.addEventListener("scroll", updateOnScroll, { passive: true });
  window.addEventListener("resize", updateOnScroll);

  const setMenuOpen = (isOpen) => {
    nav.classList.toggle("nav-open", isOpen);
    if (hamburger) {
      hamburger.setAttribute("aria-expanded", String(isOpen));
      hamburger.setAttribute(
        "aria-label",
        isOpen ? "Close navigation menu" : "Open navigation menu",
      );
    }
  };
  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) hamburger?.focus();
  };

  if (hamburger) {
    hamburger.addEventListener("click", () => {
      setMenuOpen(!nav.classList.contains("nav-open"));
    });
  }

  links.forEach((link) => {
    link.addEventListener("click", () => closeMenu());
  });

  // Close the mobile dropdown on Escape or when the viewport grows.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("nav-open")) {
      closeMenu(true);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 700) closeMenu();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  /**
   * Stagger utility.
   * Applies an incrementing transition-delay to every child matching
   * childSelector inside parentSelector. Called per page — selectors that do
   * not exist on the current document are simply skipped.
   */
  function applyStagger(parentSelector, childSelector, delay) {
    const parent = document.querySelector(parentSelector);
    if (!parent) return;

    parent.querySelectorAll(childSelector).forEach((child, index) => {
      child.style.transitionDelay = `${index * delay}s`;
    });
  }

  applyStagger("#skills", ".skill-group", 0.1);
  applyStagger("#projects", ".project-entry", 0.1);
  applyStagger("#journey", ".milestone", 0.12);

  const animatedElements = document.querySelectorAll(".fade-in-up, .fade-in-left");
  const timelineLine = document.querySelector(".timeline-line");

  // Without IntersectionObserver, show everything immediately.
  if (!("IntersectionObserver" in window)) {
    animatedElements.forEach((element) => element.classList.add("is-visible"));
    if (timelineLine) timelineLine.classList.add("line-visible");
    return;
  }

  // Single reusable scroll-reveal observer. Reveal once, then stop watching.
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );

  animatedElements.forEach((element) => revealObserver.observe(element));

  // Draw the journey timeline line downwards when the section scrolls in.
  const roadmap = document.querySelector("#journey");
  if (roadmap && timelineLine) {
    const lineObserver = new IntersectionObserver(
      (entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          timelineLine.classList.add("line-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    lineObserver.observe(roadmap);
  }

  // Hero entrance animations are intentionally CSS keyframes only.
  // Do not add hero elements to the observers above.
});

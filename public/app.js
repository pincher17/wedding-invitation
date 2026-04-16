const countdownRoot = document.querySelector("[data-countdown]");
const form = document.querySelector("#rsvp-form");
const statusNode = document.querySelector("#form-status");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

initRevealAnimations();

if (countdownRoot) {
  const targetDate = new Date(countdownRoot.dataset.countdown);
  const digitNodes = {
    days: countdownRoot.querySelector('[data-unit="days"]'),
    hours: countdownRoot.querySelector('[data-unit="hours"]'),
    minutes: countdownRoot.querySelector('[data-unit="minutes"]'),
    seconds: countdownRoot.querySelector('[data-unit="seconds"]')
  };

  const setDigits = (node, value) => {
    if (!node) return;
    const minDigits = Number(node.dataset.digits || 2);
    node.textContent = String(value).padStart(minDigits, "0");
  };

  const updateCountdown = () => {
    const diff = targetDate.getTime() - Date.now();
    const safeDiff = Math.max(diff, 0);
    const days = Math.floor(safeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((safeDiff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((safeDiff / (1000 * 60)) % 60);
    const seconds = Math.floor((safeDiff / 1000) % 60);

    setDigits(digitNodes.days, days);
    setDigits(digitNodes.hours, hours);
    setDigits(digitNodes.minutes, minutes);
    setDigits(digitNodes.seconds, seconds);
  };

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusNode.textContent = "Отправляем анкету...";

    const formData = new FormData(form);
    const payload = {
      name: formData.get("name")?.toString().trim(),
      attendance: formData.get("attendance")?.toString(),
      plusOne: formData.get("plusOne")?.toString().trim(),
      drinks: formData.getAll("drinks").map((value) => value.toString()),
      secondDay: formData.get("secondDay")?.toString(),
      comment: formData.get("comment")?.toString().trim()
    };

    try {
      const response = await fetch("api/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Ошибка отправки");
      }

      statusNode.textContent = result.message || "Спасибо. Ваша анкета успешно отправлена.";
      form.reset();
    } catch (error) {
      statusNode.textContent = error.message || "Не удалось отправить анкету.";
    }
  });
}

function initRevealAnimations() {
  const isCompactViewport = window.matchMedia("(max-width: 720px)").matches;
  const staggerStep = isCompactViewport ? 60 : 90;
  const maxDelay = isCompactViewport ? 280 : 480;

  revealHero(staggerStep);
  revealSections(staggerStep, maxDelay);
}

function revealHero(staggerStep) {
  const heroTargets = [
    document.querySelector(".hero__top"),
    document.querySelector(".hero__bottom")
  ].filter(Boolean);

  heroTargets.forEach((node, index) => {
    node.dataset.reveal = "hero";
    node.style.setProperty("--reveal-delay", `${index * staggerStep}ms`);

    if (prefersReducedMotion.matches) {
      node.classList.add("is-visible");
      return;
    }

    setTimeout(() => {
      node.classList.add("is-visible");
    }, index * staggerStep + 40);
  });
}

function revealSections(staggerStep, maxDelay) {
  const sections = [...document.querySelectorAll("main .section")];
  const sectionTargetSelectors = [
    ".section-head",
    ".intro-card .card",
    ".calendar-card",
    ".location-card > :first-child",
    ".location-card__visual",
    ".countdown-item",
    ".timeline-row",
    ".dress-code .card",
    ".palette-dots",
    ".wishes-grid .card",
    ".transfer .card > :first-child",
    ".contact-copy",
    ".contact-card h3",
    ".contact-link",
    ".contact-card .button",
    ".telegram .card > :first-child",
    ".telegram .button",
    ".footer-note p"
  ].join(", ");

  const observer = prefersReducedMotion.matches
    ? null
    : new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -12% 0px"
      }
    );

  sections.forEach((section) => {
    const targets = [...new Set(section.querySelectorAll(sectionTargetSelectors))];

    targets.forEach((node, index) => {
      node.dataset.reveal = "section";
      node.style.setProperty("--reveal-delay", `${Math.min(index * staggerStep, maxDelay)}ms`);

      if (prefersReducedMotion.matches) {
        node.classList.add("is-visible");
        return;
      }

      observer.observe(node);
    });
  });
}

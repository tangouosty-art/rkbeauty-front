// js/main.js
function initBurgerMenu() {
  const burger = document.getElementById("burger");
  const navLinks = document.querySelector(".nav-links");
  if (!burger || !navLinks) return;

  burger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
    burger.classList.toggle("active");
  });

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      burger.classList.remove("active");
    });
  });
}

function initScrollTop() {
  const btn = document.getElementById("scrollTop");
  if (!btn) return;

  window.addEventListener("scroll", () => {
    if (window.pageYOffset > 300) btn.classList.add("visible");
    else btn.classList.remove("visible");
  });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function initFadeIn() {
  const elements = document.querySelectorAll(".fade-in");
  if (!elements.length) return;

  const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  elements.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = "opacity 0.8s ease, transform 0.8s ease";
    observer.observe(el);
  });
}

// ===== KIT MODAL =====
(function () {
  const modal = document.getElementById("kitModal");
  if (!modal) return;

  const openButtons = document.querySelectorAll("[data-open-kit]");
  const closeTargets = modal.querySelectorAll("[data-close-kit]");

  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  openButtons.forEach(btn => btn.addEventListener("click", openModal));
  closeTargets.forEach(el => el.addEventListener("click", closeModal));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });
})();

// ===== CGV MODAL =====
(function () {
  const modal = document.getElementById("cgvModal");
  const openBtn = document.getElementById("openCGV");
  const closeEls = document.querySelectorAll("[data-close-cgv]");

  if (!modal || !openBtn) return;

  openBtn.addEventListener("click", () => {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  });

  closeEls.forEach(el =>
    el.addEventListener("click", () => {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    })
  );
})();



// Init global
initBurgerMenu();
initScrollTop();
initFadeIn();

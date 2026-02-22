// services.js — Mobile menu + Why Choose Us Swiper (optimized for full content visibility)
document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     MOBILE MENU (unchanged)
  ========================== */
  const mobileMenu = document.getElementById("mobileMenu");
  const navLinks = document.getElementById("navLinks");
  const overlay = document.getElementById("overlay");

  const lockScroll = () => (document.body.style.overflow = "hidden");
  const unlockScroll = () => (document.body.style.overflow = "");

  const openMenu = () => {
    if (!navLinks || !overlay) return;
    navLinks.classList.add("active");
    overlay.classList.add("active");

    const icon = mobileMenu?.querySelector("i");
    if (icon) {
      icon.classList.remove("fa-bars");
      icon.classList.add("fa-xmark");
    }

    lockScroll();
  };

  const closeMenu = () => {
    if (!navLinks || !overlay) return;
    navLinks.classList.remove("active");
    overlay.classList.remove("active");

    const icon = mobileMenu?.querySelector("i");
    if (icon) {
      icon.classList.remove("fa-xmark");
      icon.classList.add("fa-bars");
    }

    unlockScroll();
  };

  if (mobileMenu && navLinks && overlay) {
    mobileMenu.addEventListener("click", () => {
      navLinks.classList.contains("active") ? closeMenu() : openMenu();
    });

    overlay.addEventListener("click", closeMenu);

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* =========================
     SWIPER: WHY CHOOSE US
     (Enhanced for full content display)
  ========================== */
  const initWhySwiper = () => {
    const swiperEl = document.querySelector(".whySwiper");
    // If swiper section isn't on page, skip
    if (!swiperEl) return;

    // If Swiper lib not loaded, wait and retry (useful for slow networks)
    if (typeof Swiper === "undefined") {
      console.warn("Swiper not loaded yet – retrying in 200ms");
      setTimeout(initWhySwiper, 200);
      return;
    }

    // Avoid double init
    if (swiperEl.swiper) return; // Swiper stores instance on element

    // Small delay to ensure DOM is fully painted
    setTimeout(() => {
      const whySwiper = new Swiper(".whySwiper", {
        loop: true,
        spaceBetween: 24,
        speed: 650,

        autoplay: {
          delay: 3500,
          disableOnInteraction: false,
        },

        pagination: {
          el: ".swiper-pagination",
          clickable: true,
        },

        // Critical for layout changes
        observer: true,
        observeParents: true,
        watchOverflow: true,

        // NO autoHeight – we want natural card heights
        breakpoints: {
          0: { slidesPerView: 1 },
          768: { slidesPerView: 2 },
          1200: { slidesPerView: 3 },
        },

        on: {
          init() {
            this.update(); // initial recalc
          },
          resize() {
            this.update(); // recalc on resize
          },
          breakpoint() {
            this.update(); // recalc on breakpoint change
          },
          slideChange() {
            // optional: ensure active slide is fully visible
            this.update();
          }
        },
      });

      // Force an extra update after all images/fonts are ready
      window.addEventListener("load", () => {
        if (whySwiper) whySwiper.update();
      });

      // Optional: use ResizeObserver to watch card content changes
      if (window.ResizeObserver) {
        const cards = document.querySelectorAll(".advantage-card");
        const resizeObserver = new ResizeObserver(() => {
          if (whySwiper) whySwiper.update();
        });
        cards.forEach(card => resizeObserver.observe(card));
      }

    }, 50); // short delay for smoother rendering
  };

  // Start initialization
  initWhySwiper();

  // Re-run when tabs change (your existing tab logic)
  document.addEventListener("click", (e) => {
    if (e.target.closest(".tab-btn")) {
      setTimeout(() => {
        const swiperInstance = document.querySelector(".whySwiper")?.swiper;
        if (swiperInstance) swiperInstance.update();
      }, 100); // slightly longer delay to allow tab content to render
    }
  });
});
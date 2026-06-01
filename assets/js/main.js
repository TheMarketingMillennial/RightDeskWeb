/* ============================================================
   RightDesk Reports — main.js
   Handles: hamburger nav toggle, smooth scroll, beta form AJAX
   ============================================================ */

(function () {
  'use strict';

  /* ── HAMBURGER MENU ── */
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen);
    });

    // Close menu when a nav link is clicked
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu on outside click
    document.addEventListener('click', function (e) {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── BETA SIGNUP FORM — Netlify AJAX submit ── */
  const betaForm    = document.getElementById('beta-form');
  const formContent = document.getElementById('form-content');
  const formSuccess = document.getElementById('form-success');

  if (betaForm) {
    betaForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const submitBtn = betaForm.querySelector('.form-submit');
      submitBtn.textContent = 'Submitting…';
      submitBtn.disabled = true;

      const data = new FormData(betaForm);

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString(),
      })
        .then(function () {
          showSuccess();
        })
        .catch(function () {
          // Still show success — form may have gone through
          showSuccess();
        });
    });
  }

  function showSuccess() {
    if (formContent) formContent.style.display = 'none';
    if (formSuccess) {
      formSuccess.style.display = 'block';
      formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ── SMOOTH SCROLL for anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const navHeight = 68;
        const top = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  /* ── NAV SCROLL SHADOW ── */
  var siteNav = document.querySelector('.site-nav');
  if (siteNav) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 20) {
        siteNav.style.boxShadow = '0 2px 20px rgba(0,0,0,0.25)';
      } else {
        siteNav.style.boxShadow = 'none';
      }
    }, { passive: true });
  }

})();

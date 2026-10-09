/* ============================================================
   RightDesk Reports — main.js
   Handles: hamburger nav toggle, smooth scroll, contact form AJAX
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

  /* ── CONTACT FORM — Netlify AJAX submit ── */
  const contactForm = document.getElementById('beta-form');
  const formContent = document.getElementById('form-content');
  const formSuccess = document.getElementById('form-success');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const submitBtn = contactForm.querySelector('.form-submit');
      submitBtn.textContent = 'Submitting…';
      submitBtn.disabled = true;

      const data = new FormData(contactForm);

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

  /* ── PRICING TOGGLE ── */
  window.setBilling = function (mode) {
    var monthly = document.querySelectorAll('.price-monthly');
    var annual  = document.querySelectorAll('.price-annual');
    var btnM    = document.getElementById('toggle-monthly');
    var btnA    = document.getElementById('toggle-annual');
    var essBtn  = document.getElementById('essential-btn');
    var preBtn  = document.getElementById('premium-btn');

    if (mode === 'monthly') {
      monthly.forEach(function (el) { el.style.display = ''; });
      annual.forEach(function  (el) { el.style.display = 'none'; });
      if (btnM) { btnM.classList.add('active'); }
      if (btnA) { btnA.classList.remove('active'); }
      if (essBtn) { essBtn.textContent = 'Get Started — $9.99/mo'; }
      if (preBtn) { preBtn.textContent = 'Get Premium — $14.99/mo'; }
    } else {
      monthly.forEach(function (el) { el.style.display = 'none'; });
      annual.forEach(function  (el) { el.style.display = ''; });
      if (btnM) { btnM.classList.remove('active'); }
      if (btnA) { btnA.classList.add('active'); }
      if (essBtn) { essBtn.textContent = 'Get Started — $59.99/yr'; }
      if (preBtn) { preBtn.textContent = 'Get Premium — $99.99/yr'; }
    }
  };

  /* ── ATTORNEY FORM — Netlify AJAX submit ── */
  var attorneyForm    = document.getElementById('attorney-form');
  var attorneyContent = document.getElementById('attorney-form-content');
  var attorneySuccess = document.getElementById('attorney-form-success');

  if (attorneyForm) {
    attorneyForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var submitBtn = attorneyForm.querySelector('.form-submit');
      submitBtn.textContent = 'Submitting…';
      submitBtn.disabled = true;

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(attorneyForm)).toString(),
      })
        .then(function () { showAttorneySuccess(); })
        .catch(function () { showAttorneySuccess(); });
    });
  }

  function showAttorneySuccess() {
    if (attorneyContent) attorneyContent.style.display = 'none';
    if (attorneySuccess) {
      attorneySuccess.style.display = 'block';
      attorneySuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

/* Progressive navigation; the full link list remains available without JavaScript. */
(function () {
  'use strict';
  var toggle = document.querySelector('.hny-menu-toggle');
  var nav = document.getElementById('hny-primary-nav');
  var mobile = window.matchMedia('(max-width: 767px)');
  var search = document.querySelector('.hny-header-search');
  var results = document.getElementById('lunrsearchresults');
  function setOpen(open, returnFocus) {
    if (!toggle || !nav) return;
    nav.hidden = mobile.matches && !open;
    toggle.setAttribute('aria-expanded', String(!nav.hidden));
    toggle.textContent = nav.hidden ? '메뉴' : '닫기';
    if (returnFocus) toggle.focus();
  }
  if (toggle && nav) {
    toggle.hidden = false;
    setOpen(false);
    toggle.addEventListener('click', function () { setOpen(nav.hidden); });
    function onResize() { setOpen(false); }
    if (mobile.addEventListener) mobile.addEventListener('change', onResize);
    else if (mobile.addListener) mobile.addListener(onResize);
    nav.addEventListener('click', function (event) { if (event.target.closest('a')) setOpen(false); });
  }
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (results && !results.hidden) { results.hidden = true; var input = document.getElementById('lunrsearch'); if (input) input.focus(); return; }
    if (mobile.matches && nav && !nav.hidden) setOpen(false, true);
  });
  document.addEventListener('click', function (event) {
    if (results && !results.hidden && search && !search.contains(event.target)) results.hidden = true;
    var commentsToggle = event.target.closest('.show-comments');
    if (commentsToggle) {
      var comments = document.getElementById('comments');
      if (comments) {
        comments.classList.toggle('comments--show');
        commentsToggle.setAttribute('aria-expanded', String(comments.classList.contains('comments--show')));
      }
    }
    var spoiler = event.target.closest('.spoiler');
    if (spoiler) spoiler.classList.remove('spoiler');
    var gridToggle = event.target.closest('.grid-selector');
    if (gridToggle) {
      gridToggle.classList.toggle('active');
      document.querySelectorAll('.post').forEach(function (post) { post.classList.toggle('active'); });
    }
  });
}());

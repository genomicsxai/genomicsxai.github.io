(function () {
  // Maps each pill row's data-filter-group name to the data-* attribute on
  // <article> elements that holds its values.
  var GROUP_ATTR = {
    category: 'data-categories',
    discipline: 'data-tags',
    audience: 'data-audience'
  };

  var groups = document.querySelectorAll('.category-pills[data-filter-group]');
  if (!groups.length) return;

  var articles = document.querySelectorAll('.article-grid article[data-categories]');
  var emptyState = document.querySelector('.category-pills__empty-state');

  // Track active filter per group (default 'all').
  var activeFilters = {};

  // Pass 1: build a set of values that actually exist on visible articles per
  // group, so we know which pills correspond to no posts and should be
  // greyed out.
  var presentByGroup = {};
  Object.keys(GROUP_ATTR).forEach(function (g) { presentByGroup[g] = new Set(); });
  articles.forEach(function (article) {
    Object.keys(GROUP_ATTR).forEach(function (g) {
      (article.getAttribute(GROUP_ATTR[g]) || '').split(' ').forEach(function (t) {
        if (t) presentByGroup[g].add(t);
      });
    });
  });

  // A pill can stand for several tag slugs (a discipline "catch-all"): the
  // canonical slug plus any aliases, carried in data-filter-aliases. Fall back
  // to the single data-filter value for pills without aliases (e.g. categories).
  function aliasesOf(el) {
    var raw = el.getAttribute('data-filter-aliases') || el.getAttribute('data-filter') || '';
    return raw.split(' ').filter(Boolean);
  }

  // Pass 2: replace each <a>/<span> pill with a <button>; mark empty pills as
  // disabled.
  groups.forEach(function (group) {
    var groupName = group.getAttribute('data-filter-group');
    activeFilters[groupName] = 'all';

    var presentSet = presentByGroup[groupName] || new Set();

    var pills = group.querySelectorAll('.category-pills__pill');
    pills.forEach(function (pill) {
      var btn = document.createElement('button');
      btn.className = pill.className;
      btn.setAttribute('data-filter', pill.getAttribute('data-filter'));
      var aliasAttr = pill.getAttribute('data-filter-aliases');
      if (aliasAttr) btn.setAttribute('data-filter-aliases', aliasAttr);
      btn.textContent = pill.textContent;
      btn.type = 'button';

      var href = pill.getAttribute('href');
      if (href) {
        btn.setAttribute('data-href', href);
      }

      var filter = btn.getAttribute('data-filter');
      // Empty when the pill matches no visible post via ANY of its alias slugs.
      var isEmpty = filter !== 'all' && !aliasesOf(btn).some(function (s) {
        return presentSet.has(s);
      });
      if (isEmpty) {
        btn.classList.add('category-pills__pill--empty');
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      } else {
        btn.classList.remove('category-pills__pill--empty');
      }

      var isActive = pill.classList.contains('category-pills__pill--active');
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');

      pill.parentNode.replaceChild(btn, pill);
    });
  });

  function applyFilters() {
    var visibleCount = 0;
    articles.forEach(function (article) {
      var visible = true;
      Object.keys(activeFilters).forEach(function (group) {
        var f = activeFilters[group];
        if (f === 'all') return;
        var pool = (article.getAttribute(GROUP_ATTR[group]) || '').split(' ');
        // f is an array of alias slugs; a post matches if it carries ANY of them.
        var matched = f.some(function (s) { return pool.indexOf(s) !== -1; });
        if (!matched) visible = false;
      });
      article.hidden = !visible;
      if (visible) visibleCount++;
    });

    if (emptyState) {
      emptyState.hidden = visibleCount > 0;
    }
  }

  // Wire click handlers per group
  groups.forEach(function (group) {
    var groupName = group.getAttribute('data-filter-group');
    group.addEventListener('click', function (event) {
      var btn = event.target.closest('.category-pills__pill');
      if (!btn || btn.disabled) return;

      activeFilters[groupName] = btn.getAttribute('data-filter') === 'all' ? 'all' : aliasesOf(btn);

      var groupButtons = group.querySelectorAll('.category-pills__pill');
      groupButtons.forEach(function (b) {
        b.classList.remove('category-pills__pill--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('category-pills__pill--active');
      btn.setAttribute('aria-pressed', 'true');

      applyFilters();
    });
  });
})();

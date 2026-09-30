(function () {
  'use strict';

  // ── Config ──
  var CONFIG = {
    OWNER: 'genomicsxai',
    REPO: 'genomicsxai.github.io',
    DEFAULT_BRANCH: 'main',
    BLOGS_PATH: 'content/blogs',
    API_BASE: 'https://api.github.com',
    // OAuth App's public Client ID. Safe to embed in client-side code —
    // it's not a secret. (The matching client_secret is what's confidential,
    // and Device Flow doesn't need one.)
    // We use an OAuth App (not a GitHub App) because GitHub Apps cannot
    // create forks via the API — forking is a user-account action and isn't
    // in any GitHub App permission list. OAuth App with `public_repo` scope
    // can fork, which the submission flow requires.
    // Find this on the App's settings page: https://github.com/organizations/genomicsxai/settings/applications
    GITHUB_CLIENT_ID: 'Ov23lipXrX6z7KCV4d2c',
    // OAuth scope requested via Device Flow. `public_repo` is the minimum
    // needed to fork a public repo, push branches, and open PRs.
    OAUTH_SCOPE: 'public_repo',
    // CORS bridge for GitHub's OAuth endpoints. GitHub doesn't send
    // Access-Control-Allow-Origin on /login/device/code or /login/oauth/access_token,
    // so we proxy them through Vercel. The proxy holds no secrets and no state —
    // it only forwards POST bodies. See api/oauth/*.js.
    AUTH_BASE: 'https://genomicsxai-auth.vercel.app',
    SCOPE_OPTIONS: ['protocols', 'tutorials', 'negative-results', 'discussions', 'insights', 'ideas'],
    AUDIENCE_OPTIONS: ['technical', 'general', 'new-to-field'],
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10 MB
    MAX_TOTAL_SIZE: 50 * 1024 * 1024,  // 50 MB
  };

  // ── Discipline slug list (from data/disciplines.yaml, injected by Hugo) ──
  var DISCIPLINES = (function () {
    var el = document.getElementById('submit-form__disciplines-data');
    try { return el ? JSON.parse(el.textContent) : []; } catch (e) { return []; }
  })();

  // Human-readable labels for the keys Validate.run returns — used by
  // revalidate() to populate the missing-fields summary above the Submit
  // button. Keep aligned with the keys assigned in Validate.run.
  var FIELD_LABELS = {
    title: 'Title',
    authors: 'Authors',
    tags: 'Tags',
    scope: 'Scope',
    audience: 'Audience',
    labs: 'Lab',
    discipline: 'Discipline',
  };

  // ── Utility ──
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }
  function show(el) { el.style.display = ''; el.removeAttribute('hidden'); }
  function hide(el) { el.style.display = 'none'; el.setAttribute('hidden', ''); }
  function today() { return new Date().toISOString().slice(0, 10); }
  // Inverse of the existing btoa(unescape(encodeURIComponent(...))) used in onSubmit.
  function decodeBase64Utf8(b64) {
    var clean = (b64 || '').replace(/\s/g, '');
    return decodeURIComponent(escape(atob(clean)));
  }

  // ── Auth (GitHub Device Flow) ──
  // Device Flow lets a public client authenticate without a Client Secret.
  // The browser asks GitHub for a device code + user code, displays the user
  // code, and polls until the user authorizes the device on github.com.
  //
  // GitHub does not send Access-Control-Allow-Origin on its OAuth endpoints,
  // so we route the two POSTs through a Vercel CORS bridge. The bridge holds
  // no secrets and no auth state — it only forwards bodies (see api/oauth/*).
  var Auth = {
    getToken: function () { return sessionStorage.getItem('gh_token'); },
    setToken: function (t) { sessionStorage.setItem('gh_token', t); },
    clearToken: function () { sessionStorage.removeItem('gh_token'); },
    isAuthenticated: function () { return !!this.getToken(); },

    // Device-flow runtime state
    _polling: false,
    _pollTimer: null,

    startDeviceFlow: async function () {
      var resp = await fetch(CONFIG.AUTH_BASE + '/api/oauth/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: CONFIG.GITHUB_CLIENT_ID,
          scope: CONFIG.OAUTH_SCOPE,
        }),
      });
      if (!resp.ok) {
        var err = {};
        try { err = await resp.json(); } catch (_) { }
        throw new Error(err.error_description || err.error || ('HTTP ' + resp.status));
      }
      var data = await resp.json();
      if (data.error) throw new Error(data.error_description || data.error);
      // { device_code, user_code, verification_uri, expires_in, interval }
      return data;
    },

    pollForAuth: function (deviceCode, intervalSec, expiresInSec) {
      var self = this;
      var startTime = Date.now();
      var interval = Math.max(1, intervalSec || 5);
      self._polling = true;

      return new Promise(function (resolve, reject) {
        function tick() {
          if (!self._polling) return reject(new Error('cancelled'));
          if (Date.now() - startTime > (expiresInSec || 900) * 1000) {
            self._polling = false;
            return reject(new Error('Code expired. Please try again.'));
          }

          fetch(CONFIG.AUTH_BASE + '/api/oauth/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: CONFIG.GITHUB_CLIENT_ID,
              device_code: deviceCode,
            }),
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.access_token) {
                self.setToken(data.access_token);
                self._polling = false;
                return resolve(data.access_token);
              }
              if (data.error === 'authorization_pending') {
                self._pollTimer = setTimeout(tick, interval * 1000);
                return;
              }
              if (data.error === 'slow_down') {
                interval = (data.interval || interval) + 5;
                self._pollTimer = setTimeout(tick, interval * 1000);
                return;
              }
              // expired_token, access_denied, unsupported_grant_type, etc.
              self._polling = false;
              reject(new Error(data.error_description || data.error || 'Authorization failed'));
            })
            .catch(function (e) {
              self._polling = false;
              reject(e);
            });
        }

        // First poll happens after the initial interval (per the spec).
        self._pollTimer = setTimeout(tick, interval * 1000);
      });
    },

    cancelPoll: function () {
      this._polling = false;
      if (this._pollTimer) {
        clearTimeout(this._pollTimer);
        this._pollTimer = null;
      }
    },

    logout: function () {
      this.clearToken();
      FormController.user = null;
      FormController.renderAuthState();
    },
  };

  // ── GitHub API ──
  var GitHubAPI = {
    _headers: function () {
      return {
        Authorization: 'token ' + Auth.getToken(),
        Accept: 'application/vnd.github.v3+json',
      };
    },

    request: async function (method, url, body) {
      var opts = { method: method, headers: this._headers() };
      if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      var resp = await fetch(CONFIG.API_BASE + url, opts);
      if (resp.status === 204) return null;
      var data = await resp.json();
      if (!resp.ok) {
        var msg = data.message || resp.statusText;
        if (resp.status === 401) {
          Auth.clearToken();
          FormController.user = null;
          FormController.renderAuthState();
          msg = 'Authentication expired. Please sign in again.';
        }
        if (resp.status === 403 && resp.headers.get('X-RateLimit-Remaining') === '0') {
          msg = 'GitHub API rate limit reached. Please wait a few minutes and try again.';
        }
        throw new Error(msg);
      }
      return data;
    },

    getUser: function () { return this.request('GET', '/user'); },

    getContents: function (owner, repo, path) {
      return this.request('GET', '/repos/' + owner + '/' + repo + '/contents/' + path);
    },

    listOpenPRs: function () {
      return this.request('GET', '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/pulls?state=open&per_page=100');
    },

    // Wraps GitHub Search API for the "find merged PRs by author" fallback used
    // when a legacy post doesn't carry submitter_github in frontmatter yet.
    searchIssues: function (q) {
      return this.request('GET', '/search/issues?q=' + encodeURIComponent(q) + '&per_page=100');
    },

    forkRepo: function () {
      return this.request('POST', '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/forks', {});
    },

    syncFork: function (owner) {
      return this.request('POST', '/repos/' + owner + '/' + CONFIG.REPO + '/merge-upstream', { branch: CONFIG.DEFAULT_BRANCH });
    },

    getRef: function (owner, ref) {
      return this.request('GET', '/repos/' + owner + '/' + CONFIG.REPO + '/git/ref/heads/' + ref);
    },

    createRef: function (owner, ref, sha) {
      return this.request('POST', '/repos/' + owner + '/' + CONFIG.REPO + '/git/refs', { ref: 'refs/heads/' + ref, sha: sha });
    },

    deleteRef: function (owner, ref) {
      return this.request('DELETE', '/repos/' + owner + '/' + CONFIG.REPO + '/git/refs/heads/' + ref);
    },

    createBlob: function (owner, content, encoding) {
      return this.request('POST', '/repos/' + owner + '/' + CONFIG.REPO + '/git/blobs', { content: content, encoding: encoding || 'utf-8' });
    },

    createTree: function (owner, baseTree, tree) {
      return this.request('POST', '/repos/' + owner + '/' + CONFIG.REPO + '/git/trees', { base_tree: baseTree, tree: tree });
    },

    createCommit: function (owner, message, tree, parents) {
      return this.request('POST', '/repos/' + owner + '/' + CONFIG.REPO + '/git/commits', { message: message, tree: tree, parents: parents });
    },

    updateRef: function (owner, ref, sha) {
      return this.request('PATCH', '/repos/' + owner + '/' + CONFIG.REPO + '/git/refs/heads/' + ref, { sha: sha, force: true });
    },

    createPR: function (head, title, body) {
      return this.request('POST', '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/pulls', {
        title: title, head: head, base: CONFIG.DEFAULT_BRANCH, body: body,
      });
    },
  };

  // ── PostID ──
  var PostID = {
    getNext: async function () {
      var year = new Date().getFullYear().toString();
      var existing = [];
      try {
        var items = await GitHubAPI.getContents(CONFIG.OWNER, CONFIG.REPO, CONFIG.BLOGS_PATH);
        items.forEach(function (item) {
          if (item.type === 'dir' && /^\d{4}-\d{3}$/.test(item.name) && item.name.startsWith(year)) {
            existing.push(parseInt(item.name.split('-')[1], 10));
          }
        });
      } catch (e) { /* empty blog directory */ }

      // Also check open PRs for pending post IDs
      try {
        var prs = await GitHubAPI.listOpenPRs();
        prs.forEach(function (pr) {
          var m = pr.head.ref.match(/blog\/(\d{4})-(\d{3})/);
          if (m && m[1] === year) existing.push(parseInt(m[2], 10));
        });
      } catch (e) { /* ignore */ }

      var max = existing.length ? Math.max.apply(null, existing) : 0;
      var next = (max + 1).toString().padStart(3, '0');
      return year + '-' + next;
    },
  };

  // ── UpdateMode ──
  // Powers the "Update an existing post" flow. Keeps state about which post is
  // being revised, whether to pre-fill from the published version or start
  // blank, and which existing images the author wants to keep.
  var UpdateMode = {
    active: false,
    startMode: 'prefill',          // 'prefill' or 'blank'
    postId: null,
    notes: '',
    existingFrontmatter: null,
    existingBody: '',
    existingFiles: [],             // [{ name, sha, isImage }]
    removedExistingImages: {},     // { filename: true } for existing images the user toggled off
    myPosts: [],                   // [{ post_id, title, source }] for the dropdown

    IMAGE_EXTS: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],

    isImageName: function (name) {
      var lower = (name || '').toLowerCase();
      return UpdateMode.IMAGE_EXTS.some(function (ext) { return lower.endsWith(ext); });
    },

    reset: function () {
      this.active = false;
      this.startMode = 'prefill';
      this.postId = null;
      this.notes = '';
      this.existingFrontmatter = null;
      this.existingBody = '';
      this.existingFiles = [];
      this.removedExistingImages = {};
    },

    // Find every blog post attributable to the given GitHub login.
    // Primary: read each post's frontmatter and match submitter_github.
    // Fallback for legacy posts (pre-feature): GitHub search for merged PRs by
    // this user with the "Blog post YYYY-NNN: …" title pattern; confirm each
    // candidate by re-fetching its index.md.
    listMyPosts: async function (login) {
      var results = [];
      var seen = {};

      var dirItems = [];
      try {
        dirItems = await GitHubAPI.getContents(CONFIG.OWNER, CONFIG.REPO, CONFIG.BLOGS_PATH);
      } catch (e) { dirItems = []; }

      var dirs = (dirItems || []).filter(function (it) {
        return it && it.type === 'dir' && /^\d{4}-\d{3}$/.test(it.name);
      });

      await Promise.all(dirs.map(async function (dir) {
        try {
          var f = await GitHubAPI.getContents(CONFIG.OWNER, CONFIG.REPO, CONFIG.BLOGS_PATH + '/' + dir.name + '/index.md');
          var parsed = FileParser.parse(decodeBase64Utf8(f.content));
          if (!parsed) return;
          var fm = parsed.frontmatter || {};
          if (fm.submitter_github !== login) return;
          if (fm.status && fm.status !== 'published') return;
          results.push({ post_id: dir.name, title: fm.title || '(untitled)', source: 'frontmatter' });
          seen[dir.name] = true;
        } catch (e) { /* ignore individual post failures */ }
      }));

      try {
        var q = 'repo:' + CONFIG.OWNER + '/' + CONFIG.REPO + ' type:pr is:merged author:' + login + ' in:title "Blog post"';
        var search = await GitHubAPI.searchIssues(q);
        var candidates = {};
        ((search && search.items) || []).forEach(function (pr) {
          var m = (pr.title || '').match(/^Blog post (\d{4}-\d{3}):/i);
          if (!m) return;
          var id = m[1];
          if (seen[id]) return;
          candidates[id] = true;
        });
        await Promise.all(Object.keys(candidates).map(async function (id) {
          try {
            var f = await GitHubAPI.getContents(CONFIG.OWNER, CONFIG.REPO, CONFIG.BLOGS_PATH + '/' + id + '/index.md');
            var parsed = FileParser.parse(decodeBase64Utf8(f.content));
            if (!parsed) return;
            var fm = parsed.frontmatter || {};
            if (fm.status && fm.status !== 'published') return;
            results.push({ post_id: id, title: fm.title || '(untitled)', source: 'pr-search' });
            seen[id] = true;
          } catch (e) { /* ignore */ }
        }));
      } catch (e) { /* PR-search fallback is best-effort */ }

      results.sort(function (a, b) { return a.post_id < b.post_id ? 1 : -1; });
      this.myPosts = results;
      return results;
    },

    // Fetch index.md + the post directory listing so we know the file SHAs to
    // keep, replace, or delete in the update commit.
    loadPost: async function (postId) {
      var dir = CONFIG.BLOGS_PATH + '/' + postId;
      var listing = await GitHubAPI.getContents(CONFIG.OWNER, CONFIG.REPO, dir);
      var hasIndex = (listing || []).some(function (it) { return it.type === 'file' && it.name === 'index.md'; });
      if (!hasIndex) throw new Error('Could not find index.md in ' + dir);

      var indexResp = await GitHubAPI.getContents(CONFIG.OWNER, CONFIG.REPO, dir + '/index.md');
      var parsed = FileParser.parse(decodeBase64Utf8(indexResp.content));
      if (!parsed) throw new Error('Could not parse frontmatter of ' + dir + '/index.md');

      this.postId = postId;
      this.existingFrontmatter = parsed.frontmatter || {};
      this.existingBody = parsed.body || '';
      this.existingFiles = (listing || [])
        .filter(function (it) { return it.type === 'file' && it.name !== 'index.md'; })
        .map(function (it) { return { name: it.name, sha: it.sha, isImage: UpdateMode.isImageName(it.name) }; });
      this.removedExistingImages = {};
      return parsed;
    },

    // Build the part of the git tree that handles the post's *non-index.md*
    // files: keep, delete, or replace. Image blobs the user newly uploaded are
    // handled separately by the existing ImageHandler/createBlob path.
    buildExistingFileTreeItems: function (newImageFilenames) {
      var blogDir = CONFIG.BLOGS_PATH + '/' + this.postId;
      var items = [];
      var newNamesLower = {};
      (newImageFilenames || []).forEach(function (n) { newNamesLower[n.toLowerCase()] = true; });

      this.existingFiles.forEach(function (f) {
        var path = blogDir + '/' + f.name;
        var overwrittenByUpload = newNamesLower[f.name.toLowerCase()];
        var removed = !!UpdateMode.removedExistingImages[f.name];

        if (UpdateMode.startMode === 'blank') {
          // Blank mode: delete every existing non-index file unless the user
          // re-uploaded one with the same name (the new blob will replace it).
          if (!overwrittenByUpload) {
            items.push({ path: path, mode: '100644', type: 'blob', sha: null });
          }
          return;
        }

        // Pre-fill mode
        if (removed && !overwrittenByUpload) {
          items.push({ path: path, mode: '100644', type: 'blob', sha: null });
        } else if (!overwrittenByUpload) {
          // Keep the file by referencing its existing SHA
          items.push({ path: path, mode: '100644', type: 'blob', sha: f.sha });
        }
        // If overwrittenByUpload: skip — the upload path adds its own tree
        // entry with the new blob SHA and that wins because it appears later
        // in the tree array.
      });

      return items;
    },
  };

  // ── FileParser ──
  var FileParser = {
    parse: function (text) {
      var match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (!match) return null;
      try {
        var frontmatter = window.jsyaml.load(match[1]);
        return { frontmatter: frontmatter, body: match[2], rawYaml: match[1] };
      } catch (e) {
        return null;
      }
    },
  };

  // ── Validate ──
  var Validate = {
    REQUIRED: ['title', 'authors', 'tags', 'scope', 'labs'],

    run: function (fm) {
      var errors = {};

      if (!fm.title || !fm.title.trim()) errors.title = 'Title is required.';

      if (!fm.authors || !Array.isArray(fm.authors) || fm.authors.length === 0) {
        errors.authors = 'At least one author is required.';
      }

      if (!fm.tags || (Array.isArray(fm.tags) && fm.tags.length === 0)) {
        errors.tags = 'At least one tag is required.';
      }

      if (!fm.scope || (Array.isArray(fm.scope) && fm.scope.length === 0)) {
        errors.scope = 'At least one scope is required.';
      } else if (Array.isArray(fm.scope)) {
        var invalidScope = fm.scope.filter(function (s) { return CONFIG.SCOPE_OPTIONS.indexOf(s) === -1; });
        if (invalidScope.length) errors.scope = 'Invalid scope values: ' + invalidScope.join(', ');
      }

      if (fm.audience && Array.isArray(fm.audience)) {
        var invalidAud = fm.audience.filter(function (a) { return CONFIG.AUDIENCE_OPTIONS.indexOf(a) === -1; });
        if (invalidAud.length) errors.audience = 'Invalid audience values: ' + invalidAud.join(', ');
      }

      if (!fm.labs || (Array.isArray(fm.labs) && fm.labs.length === 0)) {
        errors.labs = 'Lab is required.';
      }

      if (DISCIPLINES.length) {
        var disciplineTags = (fm.tags || []).filter(function (t) {
          return DISCIPLINES.indexOf(t) !== -1;
        });
        if (disciplineTags.length === 0) {
          errors.discipline = 'Select at least one discipline.';
        }
      }

      return errors;
    },

    hasErrors: function (errors) {
      return Object.keys(errors).length > 0;
    },
  };

  // ── ImageHandler ──
  var ImageHandler = {
    files: [],
    // filename (sanitized) -> caption string. Populated as the user types in the
    // per-thumb caption input; reset on removeFile/clear.
    captions: {},
    // Sanitized filename of the image the author has marked as the post's
    // thumbnail/featured image (serialized as `image:` in YAML frontmatter).
    // May reference a new upload OR an existing image (update mode) — both
    // render paths share this single piece of state. Empty string = none.
    featuredFilename: '',

    addFiles: function (fileList) {
      var errors = [];
      var totalSize = this.files.reduce(function (sum, f) { return sum + f.size; }, 0);
      var self = this;

      for (var i = 0; i < fileList.length; i++) {
        var f = fileList[i];
        if (!f.type.startsWith('image/')) {
          errors.push(f.name + ' is not an image file.');
          continue;
        }
        if (f.size > CONFIG.MAX_IMAGE_SIZE) {
          errors.push(f.name + ' exceeds the 10 MB limit (' + (f.size / 1024 / 1024).toFixed(1) + ' MB).');
          continue;
        }
        // Dedupe by sanitized filename so clicking "Insert" doesn't double up
        // the thumbnail (TinyMCE's images_upload_handler can fire on inserted
        // blob: URLs as if they were new uploads), and so two paste actions
        // of the same image are coalesced.
        var sanitized = this.sanitizeName(f.name);
        var alreadyAdded = this.files.some(function (existing) {
          return self.sanitizeName(existing.name) === sanitized;
        });
        if (alreadyAdded) continue;
        totalSize += f.size;
        if (totalSize > CONFIG.MAX_TOTAL_SIZE) {
          errors.push('Total image size exceeds 50 MB.');
          break;
        }
        this.files.push(f);
      }
      return errors;
    },

    removeFile: function (index) {
      var f = this.files[index];
      if (f) {
        var name = this.sanitizeName(f.name);
        delete this.captions[name];
        if (this.featuredFilename === name) this.featuredFilename = '';
      }
      this.files.splice(index, 1);
    },

    clear: function () {
      this.files = [];
      this.captions = {};
      this.featuredFilename = '';
    },

    // Toggle: clicking the same image clears the selection; clicking a
    // different one switches. Caller is responsible for re-rendering.
    setFeatured: function (filename) {
      this.featuredFilename = (this.featuredFilename === filename) ? '' : filename;
    },

    sanitizeName: function (name) {
      return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
    },

    readAsBase64: function (file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          // Strip the data:...;base64, prefix
          resolve(reader.result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    renderPreviews: function () {
      var container = $('#submit-form__image-previews');
      if (!container) return;
      container.innerHTML = '';
      var self = this;
      this.files.forEach(function (f, i) {
        var sanitized = self.sanitizeName(f.name);
        var isFeatured = self.featuredFilename === sanitized;
        var thumb = document.createElement('div');
        thumb.className = 'submit-form__image-thumb' +
          (isFeatured ? ' submit-form__image-thumb--featured' : '');
        var url = URL.createObjectURL(f);

        var img = document.createElement('img');
        img.src = url;
        img.alt = f.name;

        var span = document.createElement('span');
        span.className = 'submit-form__image-name';
        span.textContent = f.name + ' (' + (f.size / 1024).toFixed(0) + ' KB)';

        var captionInput = document.createElement('textarea');
        captionInput.className = 'submit-form__image-caption';
        captionInput.rows = 3;
        captionInput.placeholder = 'Caption (figure legend, optional)';
        captionInput.value = self.captions[sanitized] || '';
        captionInput.dataset.filename = sanitized;

        var insertBtn = document.createElement('button');
        insertBtn.type = 'button';
        insertBtn.className = 'submit-form__image-insert';
        insertBtn.dataset.filename = sanitized;
        insertBtn.title = 'Insert at cursor in body';
        insertBtn.textContent = 'Insert';

        var featuredBtn = document.createElement('button');
        featuredBtn.type = 'button';
        featuredBtn.className = 'submit-form__image-featured' +
          (isFeatured ? ' is-active' : '');
        featuredBtn.dataset.filename = sanitized;
        featuredBtn.title = 'Set as post thumbnail (image: in frontmatter)';
        featuredBtn.textContent = isFeatured ? '★ Featured' : '☆ Featured';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'submit-form__image-remove';
        btn.dataset.index = String(i);
        btn.title = 'Remove';
        btn.innerHTML = '&times;';

        thumb.appendChild(img);
        thumb.appendChild(span);
        thumb.appendChild(captionInput);
        thumb.appendChild(insertBtn);
        thumb.appendChild(featuredBtn);
        thumb.appendChild(btn);
        container.appendChild(thumb);
      });
      $$('.submit-form__image-caption').forEach(function (input) {
        input.addEventListener('input', function () {
          self.captions[input.dataset.filename] = input.value;
        });
      });
      $$('.submit-form__image-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.removeFile(parseInt(btn.dataset.index, 10));
          self.renderPreviews();
          if (UpdateMode.active) FormController.renderExistingImages();
          FormController.revalidate();
        });
      });
      $$('.submit-form__image-featured').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.setFeatured(btn.dataset.filename);
          self.renderPreviews();
          if (UpdateMode.active) FormController.renderExistingImages();
          FormController.revalidate();
        });
      });
      $$('.submit-form__image-insert').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var filename = btn.dataset.filename;
          if (!filename) return;
          var caption = (self.captions[filename] || '').trim();
          if (window.SubmissionEditor && window.SubmissionEditor.body) {
            window.SubmissionEditor.insertImage(filename, caption);
            FormController.revalidate();
            return;
          }
          // Fallback: editor failed to load — insert the bracket placeholder
          // directly into the hidden markdown textarea.
          var ta = $('#submit-form__body-input');
          if (!ta) return;
          var placeholder = caption
            ? '[image: ' + filename + ' | ' + caption + ']'
            : '[image: ' + filename + ']';
          ta.value = (ta.value || '') + (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + placeholder + '\n';
          FormController.revalidate();
        });
      });
    },
  };

  // ── Progress ──
  var Progress = {
    steps: [
      { id: 'fork', label: 'Forking repository' },
      { id: 'branch', label: 'Creating branch' },
      { id: 'upload', label: 'Uploading files' },
      { id: 'commit', label: 'Creating commit' },
      { id: 'pr', label: 'Opening pull request' },
    ],
    currentStep: -1,
    lastCompletedStep: -1,

    render: function () {
      var container = $('#submit-form__progress');
      if (!container) return;
      show(container);
      var html = '<div class="submit-form__progress-steps">';
      var self = this;
      this.steps.forEach(function (step, i) {
        var cls = 'submit-form__progress-step';
        if (i < self.currentStep) cls += ' submit-form__progress-step--done';
        else if (i === self.currentStep) cls += ' submit-form__progress-step--active';
        html += '<div class="' + cls + '">';
        html += '<span class="submit-form__progress-icon">';
        if (i < self.currentStep) html += '&#10003;';
        else if (i === self.currentStep) html += '<span class="submit-form__spinner"></span>';
        else html += (i + 1);
        html += '</span>';
        html += '<span class="submit-form__progress-label">' + step.label + '</span>';
        html += '</div>';
      });
      html += '</div>';
      container.innerHTML = html;
    },

    setStep: function (index) {
      this.currentStep = index;
      this.render();
    },

    complete: function (index) {
      this.lastCompletedStep = index;
      this.currentStep = index + 1;
      this.render();
    },

    showError: function (msg) {
      var container = $('#submit-form__progress');
      if (!container) return;
      var activeStep = container.querySelector('.submit-form__progress-step--active');
      if (activeStep) {
        activeStep.classList.remove('submit-form__progress-step--active');
        activeStep.classList.add('submit-form__progress-step--error');
      }
      var errorEl = $('#submit-form__error');
      if (errorEl) {
        errorEl.textContent = msg;
        show(errorEl);
      }
    },

    reset: function () {
      this.currentStep = -1;
      this.lastCompletedStep = -1;
      var container = $('#submit-form__progress');
      if (container) { container.innerHTML = ''; hide(container); }
      var errorEl = $('#submit-form__error');
      if (errorEl) { errorEl.textContent = ''; hide(errorEl); }
    },
  };

  // ── MarkdownGen ──
  var MarkdownGen = {
    generate: function (fm, body) {
      var lines = ['---'];

      lines.push('post_id: "' + fm.post_id + '"');
      lines.push('title: "' + (fm.title || '').replace(/"/g, '\\"') + '"');
      if (fm.image) lines.push('image: "' + fm.image + '"');
      lines.push('');

      // authors
      lines.push('authors: ' + JSON.stringify(fm.authors || []));
      if (fm.authors_display && fm.authors_display.length) {
        lines.push('');
        lines.push('authors_display:');
        fm.authors_display.forEach(function (a) {
          lines.push('  - name: "' + (a.name || '').replace(/"/g, '\\"') + '"');
          lines.push('    affiliation: "' + (a.affiliation || '').replace(/"/g, '\\"') + '"');
          lines.push('    orcid: "' + (a.orcid || '') + '"');
        });
      }
      lines.push('');

      lines.push('editor: "' + (fm.editor || 'TBD') + '"');
      if (fm.submitter_github) {
        lines.push('submitter_github: "' + fm.submitter_github + '"');
      }
      lines.push('');
      lines.push('tags: ' + JSON.stringify(fm.tags || []));
      lines.push('categories: ' + JSON.stringify(fm.categories || ['Blog Post']));
      lines.push('');
      lines.push('scope: ' + JSON.stringify(fm.scope || []));
      lines.push('audience: ' + JSON.stringify(fm.audience || []));
      lines.push('labs: ' + JSON.stringify(fm.labs || []));
      lines.push('');
      var status = fm.status || 'submitted';
      lines.push('status: "' + status + '"');
      var revision = parseInt(fm.revision, 10);
      if (!revision || isNaN(revision)) revision = 1;
      lines.push('revision: ' + revision);
      lines.push('');
      lines.push('date_submitted: ' + (fm.date_submitted || today()));
      lines.push('date_accepted:' + (fm.date_accepted ? ' ' + fm.date_accepted : ''));
      lines.push('date: ' + (fm.date || fm.date_submitted || today()));
      lines.push('');
      lines.push('doi: "' + (fm.doi || '') + '"');

      // revision_history: emit the merged history if present, else seed a single entry
      var history = Array.isArray(fm.revision_history) && fm.revision_history.length
        ? fm.revision_history
        : [{ version: 1, date: fm.date_submitted || today(), notes: 'Initial submission' }];
      lines.push('revision_history:');
      history.forEach(function (h) {
        lines.push('  - version: ' + (h.version || 1));
        lines.push('    date: ' + (h.date || today()));
        lines.push('    notes: "' + String(h.notes || '').replace(/"/g, '\\"') + '"');
      });

      lines.push('---');
      lines.push('');
      lines.push(body || '');

      return lines.join('\n');
    },

    expandImageKeywords: function (body) {
      // Accepts [image: filename.png] or [image: filename.png | Caption text].
      // The caption (if any) becomes the alt text — Hugo's render-image.html
      // surfaces it as the figure legend on the published page.
      return (body || '').replace(/\[image:\s*([a-z0-9._-]+)\s*(?:\|\s*([^\]]*?)\s*)?\]/gi, function (_m, name, caption) {
        var clean = name.toLowerCase();
        var alt = (caption || '').trim() || clean;
        return '![' + alt.replace(/\]/g, '\\]') + '](' + clean + ')';
      });
    },
  };

  // ── FormController ──
  var FormController = {
    parsed: null,     // { frontmatter, body }
    postId: null,
    user: null,
    submitting: false,

    init: function () {
      var form = $('#submit-form');
      if (!form) return;

      // If we have a token from a prior OAuth round-trip, validate it.
      if (Auth.isAuthenticated()) {
        this.checkSession();
      }

      this.bindEvents();
      this.renderAuthState();
    },

    checkSession: async function () {
      try {
        this.user = await GitHubAPI.getUser();
        this.renderAuthState();
      } catch (e) {
        // 401 / token invalid → clearToken/null already done in request()
        this.user = null;
        this.renderAuthState();
      }
    },

    bindEvents: function () {
      var self = this;

      // Auth
      var loginBtn = $('#submit-form__login-btn');
      if (loginBtn) loginBtn.addEventListener('click', function () { self.onLoginClick(); });

      var cancelBtn = $('#submit-form__device-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { self.onCancelLogin(); });

      var copyBtn = $('#submit-form__device-code-copy');
      if (copyBtn) copyBtn.addEventListener('click', function () { self.onCopyDeviceCode(); });

      var logoutBtn = $('#submit-form__logout-btn');
      if (logoutBtn) logoutBtn.addEventListener('click', function () { Auth.logout(); });

      // File upload
      var fileInput = $('#submit-form__file-input');
      if (fileInput) fileInput.addEventListener('change', function (e) { self.onFileSelected(e); });

      // Start-blank button (manual fill)
      var startBlankBtn = $('#submit-form__start-blank-btn');
      if (startBlankBtn) startBlankBtn.addEventListener('click', function () { self.startBlank(); });

      var dropZone = $('#submit-form__drop-zone');
      if (dropZone) {
        dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('submit-form__drop-zone--active'); });
        dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('submit-form__drop-zone--active'); });
        dropZone.addEventListener('drop', function (e) {
          e.preventDefault();
          dropZone.classList.remove('submit-form__drop-zone--active');
          var files = e.dataTransfer.files;
          if (files.length === 1 && files[0].name.endsWith('.md')) {
            self.loadMarkdownFile(files[0]);
          }
        });
        dropZone.addEventListener('click', function () { if (fileInput) fileInput.click(); });
      }

      // Image upload
      var imgInput = $('#submit-form__img-input');
      if (imgInput) imgInput.addEventListener('change', function (e) { self.onImagesSelected(e); });

      var imgDropZone = $('#submit-form__img-drop-zone');
      if (imgDropZone) {
        imgDropZone.addEventListener('dragover', function (e) { e.preventDefault(); imgDropZone.classList.add('submit-form__drop-zone--active'); });
        imgDropZone.addEventListener('dragleave', function () { imgDropZone.classList.remove('submit-form__drop-zone--active'); });
        imgDropZone.addEventListener('drop', function (e) {
          e.preventDefault();
          imgDropZone.classList.remove('submit-form__drop-zone--active');
          self.onImagesSelected({ target: { files: e.dataTransfer.files } });
        });
        imgDropZone.addEventListener('click', function () { if (imgInput) imgInput.click(); });
      }

      // Submit
      var submitBtn = $('#submit-form__submit-btn');
      if (submitBtn) submitBtn.addEventListener('click', function () { self.onSubmit(); });

      // Editable field changes re-trigger validation
      $$('.submit-form__editable').forEach(function (el) {
        el.addEventListener('input', function () { self.revalidate(); });
        el.addEventListener('change', function () { self.revalidate(); });
      });

      // Mode chooser (new vs update)
      var modeRadios = $$('input[name="sf-mode"]');
      modeRadios.forEach(function (r) {
        r.addEventListener('change', function () { self.onModeChange(); });
      });
      var startRadios = $$('input[name="sf-update-start"]');
      startRadios.forEach(function (r) {
        r.addEventListener('change', function () { self.refreshModeContinueState(); });
      });
      var notesEl = $('#sf-update-notes');
      if (notesEl) {
        notesEl.addEventListener('input', function () { self.refreshModeContinueState(); });
      }
      var postPicker = $('#sf-update-post');
      if (postPicker) {
        postPicker.addEventListener('change', function () { self.refreshModeContinueState(); });
      }
      var continueBtn = $('#submit-form__mode-continue');
      if (continueBtn) {
        continueBtn.addEventListener('click', function () { self.onModeContinue(); });
      }
    },

    showModeError: function (msg) {
      var el = $('#submit-form__mode-error');
      if (!el) return;
      el.textContent = msg || '';
      if (msg) show(el); else hide(el);
    },

    onModeChange: function () {
      var update = ($('#sf-mode-update') || {}).checked;
      var options = $('#submit-form__update-options');
      if (options) {
        if (update) show(options); else hide(options);
      }
      this.showModeError('');
      this.refreshModeContinueState();
    },

    refreshModeContinueState: function () {
      var btn = $('#submit-form__mode-continue');
      if (!btn) return;
      var isUpdate = ($('#sf-mode-update') || {}).checked;
      if (!isUpdate) {
        btn.disabled = false;
        return;
      }
      var postSel = $('#sf-update-post');
      var picked = postSel && postSel.value;
      var notes = (($('#sf-update-notes') || {}).value || '').trim();
      btn.disabled = !(picked && notes);
    },

    populatePostPicker: async function () {
      var sel = $('#sf-update-post');
      var help = $('#sf-update-post-help');
      if (!sel) return;
      sel.innerHTML = '<option value="">Loading your posts…</option>';
      sel.disabled = true;
      try {
        var posts = await UpdateMode.listMyPosts(this.user.login);
        if (!posts.length) {
          sel.innerHTML = "<option value=\"\">You don't have any previous posts</option>";
          if (help) help.textContent = "We couldn't find any published posts attributed to @" + this.user.login + '. Submit a new post first, or contact an editor if this looks wrong.';
          sel.disabled = true;
          return;
        }
        sel.innerHTML = '<option value="">— Choose a post —</option>' +
          posts.map(function (p) {
            return '<option value="' + p.post_id + '">' + p.post_id + ' — ' + p.title.replace(/</g, '&lt;') + '</option>';
          }).join('');
        sel.disabled = false;
        if (help) help.textContent = 'Only posts you originally submitted appear here.';
      } catch (e) {
        sel.innerHTML = '<option value="">Could not load posts</option>';
        if (help) help.textContent = 'Error loading your posts: ' + e.message;
        sel.disabled = true;
      }
    },

    onModeContinue: async function () {
      var isUpdate = ($('#sf-mode-update') || {}).checked;
      var continueBtn = $('#submit-form__mode-continue');
      this.showModeError('');

      if (!isUpdate) {
        UpdateMode.reset();
        this.revealPostModeBody();
        // Show the full form by default so users can fill it in manually
        // without first uploading an index.md. Uploading just pre-fills.
        this.startBlank();
        return;
      }

      var postId = ($('#sf-update-post') || {}).value;
      var startMode = ($('#sf-update-start-blank') || {}).checked ? 'blank' : 'prefill';
      var notes = (($('#sf-update-notes') || {}).value || '').trim();
      if (!postId || !notes) {
        this.showModeError('Pick a post and add a one-line revision note.');
        return;
      }

      if (continueBtn) { continueBtn.disabled = true; continueBtn.textContent = 'Loading…'; }
      try {
        await UpdateMode.loadPost(postId);
        UpdateMode.active = true;
        UpdateMode.startMode = startMode;
        UpdateMode.notes = notes;
        this.revealPostModeBody();

        if (startMode === 'prefill') {
          // Re-use the existing populate path so all field bindings run identically
          // to the file-upload flow.
          this.parsed = {
            frontmatter: UpdateMode.existingFrontmatter,
            body: UpdateMode.existingBody,
            rawYaml: '',
          };
          this.populateFields(UpdateMode.existingFrontmatter || {});
          this.setBody(UpdateMode.existingBody || '');
          // Carry over the published post's `image:` so the existing-image
          // thumb shows ★ Featured on load. User can re-pick from new
          // uploads or clear via the toggle.
          var existingImage = (UpdateMode.existingFrontmatter || {}).image;
          ImageHandler.featuredFilename = existingImage
            ? String(existingImage).toLowerCase()
            : '';
          this.renderExistingImages();
          show($('#submit-form__fields'));
          show($('#submit-form__body-section'));
          show($('#submit-form__actions'));
        } else {
          // Blank: keep post_id from UpdateMode, but show the form empty so the
          // author can upload an entirely new index.md or write from scratch.
          this.parsed = { frontmatter: {}, body: '', rawYaml: '' };
        }
        this.revalidate();
      } catch (e) {
        this.showModeError('Could not load post: ' + e.message);
      } finally {
        if (continueBtn) { continueBtn.disabled = false; continueBtn.textContent = 'Continue'; }
      }
    },

    revealPostModeBody: function () {
      var body = $('#submit-form__post-mode-body');
      if (body) show(body);
      this.renderUpdateBanner();
    },

    renderUpdateBanner: function () {
      var el = $('#submit-form__update-banner');
      if (!el) return;
      if (!UpdateMode.active) { hide(el); el.innerHTML = ''; return; }
      var fm = UpdateMode.existingFrontmatter || {};
      var nextRev = (parseInt(fm.revision, 10) || 1) + 1;
      el.innerHTML =
        '<strong>Updating ' + UpdateMode.postId + '</strong> — "' +
        (fm.title || '(untitled)').replace(/</g, '&lt;') + '" (revision ' + nextRev + ').' +
        ' This PR will modify <code>content/blogs/' + UpdateMode.postId + '/index.md</code>.';
      show(el);
    },

    renderExistingImages: function () {
      var wrap = $('#submit-form__existing-images-wrap');
      var container = $('#submit-form__existing-images');
      if (!wrap || !container) return;
      var imgFiles = UpdateMode.existingFiles.filter(function (f) { return f.isImage; });
      if (!UpdateMode.active || UpdateMode.startMode !== 'prefill' || imgFiles.length === 0) {
        hide(wrap);
        container.innerHTML = '';
        return;
      }
      container.innerHTML = '';
      imgFiles.forEach(function (f) {
        var thumb = document.createElement('div');
        var removed = !!UpdateMode.removedExistingImages[f.name];
        var fname = f.name.toLowerCase();
        var isFeatured = ImageHandler.featuredFilename === fname;
        thumb.className = 'submit-form__image-thumb submit-form__image-thumb--existing' +
          (removed ? ' submit-form__image-thumb--removed' : '') +
          (isFeatured ? ' submit-form__image-thumb--featured' : '');

        var img = document.createElement('img');
        img.src = 'https://raw.githubusercontent.com/' + CONFIG.OWNER + '/' + CONFIG.REPO +
          '/' + CONFIG.DEFAULT_BRANCH + '/' + CONFIG.BLOGS_PATH + '/' + UpdateMode.postId + '/' + encodeURIComponent(f.name);
        img.alt = f.name;

        var span = document.createElement('span');
        span.className = 'submit-form__image-name';
        span.textContent = f.name;

        var captionInput = document.createElement('textarea');
        captionInput.className = 'submit-form__image-caption';
        captionInput.rows = 3;
        captionInput.placeholder = 'Caption (figure legend, optional)';

        var insertBtn = document.createElement('button');
        insertBtn.type = 'button';
        insertBtn.className = 'submit-form__image-insert';
        insertBtn.dataset.filename = f.name.toLowerCase();
        insertBtn.title = 'Insert at cursor in body';
        insertBtn.textContent = 'Insert';
        insertBtn.addEventListener('click', function () {
          var filename = f.name.toLowerCase();
          var caption = (captionInput.value || '').trim();
          if (window.SubmissionEditor && window.SubmissionEditor.body) {
            window.SubmissionEditor.insertImage(filename, caption);
            FormController.revalidate();
            return;
          }
          var ta = $('#submit-form__body-input');
          if (!ta) return;
          var placeholder = caption
            ? '[image: ' + filename + ' | ' + caption + ']'
            : '[image: ' + filename + ']';
          ta.value = (ta.value || '') + (ta.value && !ta.value.endsWith('\n') ? '\n' : '') + placeholder + '\n';
          FormController.revalidate();
        });

        var featuredBtn = document.createElement('button');
        featuredBtn.type = 'button';
        featuredBtn.className = 'submit-form__image-featured' +
          (isFeatured ? ' is-active' : '');
        featuredBtn.title = 'Set as post thumbnail (image: in frontmatter)';
        featuredBtn.textContent = isFeatured ? '★ Featured' : '☆ Featured';
        featuredBtn.addEventListener('click', function () {
          ImageHandler.setFeatured(fname);
          FormController.renderExistingImages();
          ImageHandler.renderPreviews();
          FormController.revalidate();
        });

        var keepBtn = document.createElement('button');
        keepBtn.type = 'button';
        keepBtn.className = 'submit-form__image-keep';
        keepBtn.textContent = removed ? 'Removed — click to keep' : 'Keep — click to remove';
        keepBtn.addEventListener('click', function () {
          if (UpdateMode.removedExistingImages[f.name]) {
            delete UpdateMode.removedExistingImages[f.name];
          } else {
            UpdateMode.removedExistingImages[f.name] = true;
            // If the user is removing the existing image they had featured,
            // also drop the featured selection so submit doesn't fail the
            // "image must exist" sanity check.
            if (ImageHandler.featuredFilename === fname) {
              ImageHandler.featuredFilename = '';
              ImageHandler.renderPreviews();
            }
          }
          FormController.renderExistingImages();
          FormController.revalidate();
        });

        thumb.appendChild(img);
        thumb.appendChild(span);
        thumb.appendChild(captionInput);
        thumb.appendChild(insertBtn);
        thumb.appendChild(featuredBtn);
        thumb.appendChild(keepBtn);
        container.appendChild(thumb);
      });
      show(wrap);
    },

    renderAuthState: function () {
      var loginSection = $('#submit-form__auth-login');
      var userSection = $('#submit-form__auth-user');
      var pendingSection = $('#submit-form__auth-pending');
      var formBody = $('#submit-form__body');

      if (Auth.isAuthenticated() && this.user) {
        hide(loginSection);
        if (pendingSection) hide(pendingSection);
        show(userSection);
        $('#submit-form__username').textContent = '@' + this.user.login;
        show(formBody);
        // Kick off populating the "update an existing post" dropdown. Best-effort:
        // the new-post path doesn't depend on this completing.
        this.populatePostPicker();
        this.refreshModeContinueState();
      } else {
        show(loginSection);
        if (pendingSection) hide(pendingSection);
        hide(userSection);
        hide(formBody);
        // Reset post-mode UI so re-login starts clean
        var postBody = $('#submit-form__post-mode-body');
        if (postBody) hide(postBody);
        var modeNew = $('#sf-mode-new');
        if (modeNew) modeNew.checked = true;
        var modeUpdate = $('#sf-mode-update');
        if (modeUpdate) modeUpdate.checked = false;
        var updateOpts = $('#submit-form__update-options');
        if (updateOpts) hide(updateOpts);
        UpdateMode.reset();
      }
    },

    onLoginClick: async function () {
      var loginSection = $('#submit-form__auth-login');
      var pendingSection = $('#submit-form__auth-pending');
      var statusEl = $('#submit-form__device-status');
      var codeDisplay = $('#submit-form__device-code-display');
      var deviceLink = $('#submit-form__device-link');

      hide(loginSection);
      show(pendingSection);
      if (codeDisplay) codeDisplay.textContent = '';
      if (statusEl) statusEl.textContent = 'Requesting device code from GitHub…';

      try {
        var device = await Auth.startDeviceFlow();
        if (codeDisplay) codeDisplay.textContent = device.user_code || '';
        if (deviceLink && device.verification_uri) {
          deviceLink.href = device.verification_uri;
          deviceLink.textContent = device.verification_uri;
        }
        if (statusEl) statusEl.textContent = 'Waiting for you to authorize on GitHub…';

        // Try to copy the code to clipboard automatically. Best-effort.
        if (device.user_code && navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(device.user_code).catch(function () { });
        }

        await Auth.pollForAuth(device.device_code, device.interval, device.expires_in);
        // Token was set by Auth.pollForAuth on success.
        hide(pendingSection);
        await this.checkSession();
      } catch (e) {
        hide(pendingSection);
        show(loginSection);
        if (e && e.message !== 'cancelled') {
          this.showFormError('Sign-in failed: ' + e.message);
        }
      }
    },

    onCancelLogin: function () {
      Auth.cancelPoll();
      hide($('#submit-form__auth-pending'));
      show($('#submit-form__auth-login'));
    },

    onCopyDeviceCode: function () {
      var codeEl = $('#submit-form__device-code-display');
      var btn = $('#submit-form__device-code-copy');
      if (!codeEl || !btn) return;
      var code = codeEl.textContent;
      if (!code) return;
      var setLabel = function (text) {
        var orig = btn.dataset.origText || btn.textContent;
        btn.dataset.origText = orig;
        btn.textContent = text;
        setTimeout(function () { btn.textContent = orig; }, 1500);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(function () { setLabel('Copied!'); }, function () { setLabel('Press Cmd+C'); });
      } else {
        setLabel('Press Cmd+C');
      }
    },


    loadMarkdownFile: function (file) {
      var self = this;
      var reader = new FileReader();
      reader.onload = function () {
        var result = FileParser.parse(reader.result);
        if (!result) {
          self.showFormError('Could not parse the file. Make sure it starts with --- YAML frontmatter.');
          return;
        }
        self.parsed = result;
        self.populateFields(result.frontmatter);
        self.setBody(result.body || '');
        // Mirror an `image: foo.png` from the uploaded frontmatter into the
        // ★ Featured selection so the right thumbnail lights up as soon as
        // the user drops foo.png into the Images section.
        if (result.frontmatter && result.frontmatter.image) {
          ImageHandler.featuredFilename = String(result.frontmatter.image).toLowerCase();
          ImageHandler.renderPreviews();
        }
        self.revalidate();
        show($('#submit-form__fields'));
        show($('#submit-form__body-section'));
        show($('#submit-form__actions'));
        hide($('#submit-form__parse-error'));
        // Show file name
        var nameEl = $('#submit-form__file-name');
        if (nameEl) { nameEl.textContent = file.name; show(nameEl); }
      };
      reader.readAsText(file);
    },

    startBlank: function () {
      this.parsed = { frontmatter: {}, body: '', rawYaml: '' };
      this.populateFields({});
      this.setBody('');
      show($('#submit-form__fields'));
      show($('#submit-form__body-section'));
      show($('#submit-form__actions'));
      hide($('#submit-form__parse-error'));
      this.revalidate();
    },

    // Single entry point for "load a markdown blob into the writing area."
    // Routes through SubmissionEditor (which splits {{< summary >}} and loads
    // both editors); falls back to writing the hidden textareas directly if
    // the editor module didn't load.
    setBody: function (md) {
      if (window.SubmissionEditor && (window.SubmissionEditor.body || window.SubmissionEditor.summary)) {
        window.SubmissionEditor.setMarkdown(md || '');
        return;
      }
      var bodyInput = $('#submit-form__body-input');
      if (bodyInput) bodyInput.value = md || '';
      var summaryInput = $('#submit-form__summary-input');
      if (summaryInput) summaryInput.value = '';
    },

    onFileSelected: function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!file.name.endsWith('.md')) {
        this.showFormError('Please upload a Markdown (.md) file.');
        return;
      }
      this.loadMarkdownFile(file);
    },

    onImagesSelected: function (e) {
      var errors = ImageHandler.addFiles(e.target.files);
      if (errors.length) this.showFormError(errors.join(' '));
      ImageHandler.renderPreviews();
      // Reset input so same file can be re-selected
      if (e.target.value) e.target.value = '';
    },

    populateFields: function (fm) {
      var setVal = function (id, val) {
        var el = $('#' + id);
        if (el) el.value = val || '';
      };

      setVal('sf-title', fm.title);
      setVal('sf-tags', Array.isArray(fm.tags) ? fm.tags.join(', ') : (fm.tags || ''));
      setVal('sf-labs', Array.isArray(fm.labs) ? fm.labs.join(', ') : (fm.labs || ''));
      setVal('sf-date', fm.date || fm.date_submitted || today());

      // Authors
      var authorsContainer = $('#sf-authors-list');
      if (authorsContainer && fm.authors) {
        authorsContainer.innerHTML = '';
        var display = fm.authors_display || [];
        var authors = Array.isArray(fm.authors) ? fm.authors : [fm.authors];
        authors.forEach(function (name, i) {
          var d = display[i] || {};
          var row = document.createElement('div');
          row.className = 'submit-form__author-row';
          row.innerHTML =
            '<input type="text" class="submit-form__input submit-form__editable" placeholder="Name" value="' + (d.name || name || '').replace(/"/g, '&quot;') + '" data-field="author-name">' +
            '<input type="text" class="submit-form__input submit-form__editable" placeholder="Affiliation" value="' + (d.affiliation || '').replace(/"/g, '&quot;') + '" data-field="author-affiliation">' +
            '<input type="text" class="submit-form__input submit-form__editable" placeholder="ORCID" value="' + (d.orcid || '') + '" data-field="author-orcid">' +
            '<button type="button" class="submit-form__author-remove" title="Remove">&times;</button>';
          authorsContainer.appendChild(row);
        });
        this.bindAuthorRemoveButtons();
      }

      // Scope checkboxes
      CONFIG.SCOPE_OPTIONS.forEach(function (opt) {
        var cb = $('#sf-scope-' + opt);
        if (cb) cb.checked = Array.isArray(fm.scope) && fm.scope.indexOf(opt) !== -1;
      });

      // Audience checkboxes
      CONFIG.AUDIENCE_OPTIONS.forEach(function (opt) {
        var cb = $('#sf-audience-' + opt);
        if (cb) cb.checked = Array.isArray(fm.audience) && fm.audience.indexOf(opt) !== -1;
      });

      // Discipline checkboxes — pre-check any disciplines already in the uploaded tags
      var existingTags = (Array.isArray(fm.tags) ? fm.tags : []).map(function (t) {
        return String(t).toLowerCase();
      });
      $$('.submit-form__discipline').forEach(function (cb) {
        cb.checked = existingTags.indexOf(cb.dataset.slug) !== -1;
      });

      // Category radio — uploaded/prefilled `categories: [...]` ticks the
      // matching radio; if no match (legacy/unknown value) or no value at
      // all, fall back to "Blog Post" so the form always has a valid choice.
      var fmCategory = (Array.isArray(fm.categories) && fm.categories.length > 0)
        ? String(fm.categories[0])
        : 'Blog Post';
      var matched = false;
      $$('input[name="sf-category"]').forEach(function (r) {
        if (r.value === fmCategory) {
          r.checked = true;
          matched = true;
        } else {
          r.checked = false;
        }
      });
      if (!matched) {
        var fallback = $('input[name="sf-category"][value="Blog Post"]');
        if (fallback) fallback.checked = true;
      }
    },

    bindAuthorRemoveButtons: function () {
      var self = this;
      $$('.submit-form__author-remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          btn.parentElement.remove();
          self.revalidate();
        });
      });
    },

    addAuthorRow: function () {
      var container = $('#sf-authors-list');
      if (!container) return;
      var row = document.createElement('div');
      row.className = 'submit-form__author-row';
      row.innerHTML =
        '<input type="text" class="submit-form__input submit-form__editable" placeholder="Name" data-field="author-name">' +
        '<input type="text" class="submit-form__input submit-form__editable" placeholder="Affiliation" data-field="author-affiliation">' +
        '<input type="text" class="submit-form__input submit-form__editable" placeholder="ORCID" data-field="author-orcid">' +
        '<button type="button" class="submit-form__author-remove" title="Remove">&times;</button>';
      container.appendChild(row);
      this.bindAuthorRemoveButtons();
    },

    readFieldsToFrontmatter: function () {
      // Start from whatever frontmatter the user loaded (upload, prefill, or blank).
      // In update mode, layer the existing post's frontmatter underneath so that
      // fields the user can't edit via the form (post_id, date_submitted, etc.)
      // survive even in "start blank" mode.
      var base = (UpdateMode.active && UpdateMode.existingFrontmatter)
        ? Object.assign({}, UpdateMode.existingFrontmatter, this.parsed ? this.parsed.frontmatter : {})
        : Object.assign({}, this.parsed ? this.parsed.frontmatter : {});
      var fm = base;

      fm.title = ($('#sf-title') || {}).value || '';

      // Authors from rows
      var authorRows = $$('.submit-form__author-row');
      fm.authors = [];
      fm.authors_display = [];
      authorRows.forEach(function (row) {
        var inputs = row.querySelectorAll('input');
        var name = (inputs[0] || {}).value || '';
        if (!name.trim()) return;
        fm.authors.push(name.trim());
        fm.authors_display.push({
          name: name.trim(),
          affiliation: (inputs[1] || {}).value || '',
          orcid: (inputs[2] || {}).value || '',
        });
      });

      var tagsVal = ($('#sf-tags') || {}).value || '';
      fm.tags = tagsVal.split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);

      // Merge checked discipline slugs into tags (deduplicated, user-typed tags first)
      $$('.submit-form__discipline:checked').forEach(function (cb) {
        var slug = cb.dataset.slug;
        if (slug && fm.tags.indexOf(slug) === -1) fm.tags.push(slug);
      });

      fm.scope = [];
      CONFIG.SCOPE_OPTIONS.forEach(function (opt) {
        var cb = $('#sf-scope-' + opt);
        if (cb && cb.checked) fm.scope.push(opt);
      });

      fm.audience = [];
      CONFIG.AUDIENCE_OPTIONS.forEach(function (opt) {
        var cb = $('#sf-audience-' + opt);
        if (cb && cb.checked) fm.audience.push(opt);
      });

      var labsVal = ($('#sf-labs') || {}).value || '';
      fm.labs = labsVal.split(',').map(function (l) { return l.trim(); }).filter(Boolean);

      // Featured/thumbnail image — driven by the ★ Featured toggle on the
      // image previews. The post-submit sanity check (around line 1543)
      // verifies the named image still exists in the uploads before the PR
      // is opened, so a stale value (e.g. user deselected after upload)
      // gets cleaned up there too.
      if (ImageHandler.featuredFilename) {
        fm.image = ImageHandler.featuredFilename;
      } else {
        delete fm.image;
      }

      fm.date = ($('#sf-date') || {}).value || today();
      fm.date_submitted = fm.date_submitted || today();
      // DOI is assigned by Zenodo on publication, not set by the author.

      // Auto-set fields
      fm.editor = fm.editor || 'TBD';
      // Category — read from the radio group. The HTML pre-checks the
      // "Blog Post" radio so this always returns a value; the fm.categories
      // fallback only matters if the radios somehow aren't in the DOM
      // (e.g. JS run before shortcode rendered).
      var categoryRadio = $('input[name="sf-category"]:checked');
      fm.categories = categoryRadio
        ? [categoryRadio.value]
        : (fm.categories || ['Blog Post']);
      fm.status = 'submitted';

      if (UpdateMode.active) {
        var existing = UpdateMode.existingFrontmatter || {};
        fm.post_id = UpdateMode.postId;
        // Preserve the original submitter — never overwrite. Backfill on legacy
        // posts that don't carry the field yet (the PR-search fallback already
        // proved this user authored the original PR).
        fm.submitter_github = existing.submitter_github || (this.user && this.user.login) || fm.submitter_github;
        fm.date_submitted = existing.date_submitted || fm.date_submitted || today();
        var prevRev = parseInt(existing.revision, 10);
        if (!prevRev || isNaN(prevRev)) prevRev = 1;
        fm.revision = prevRev + 1;
        var history = Array.isArray(existing.revision_history) ? existing.revision_history.slice() : [];
        if (history.length === 0) {
          history.push({ version: 1, date: existing.date_submitted || today(), notes: 'Initial submission' });
        }
        history.push({ version: fm.revision, date: today(), notes: UpdateMode.notes || 'Update' });
        fm.revision_history = history;
      } else {
        fm.revision = fm.revision || 1;
        if (this.user && this.user.login) fm.submitter_github = this.user.login;
      }

      return fm;
    },

    revalidate: function () {
      var fm = this.readFieldsToFrontmatter();
      var errors = Validate.run(fm);

      // Clear all errors
      $$('.submit-form__field-error').forEach(function (el) { el.textContent = ''; hide(el); });
      $$('.submit-form__input--error').forEach(function (el) { el.classList.remove('submit-form__input--error'); });

      // Show errors
      Object.keys(errors).forEach(function (field) {
        var errEl = $('#sf-error-' + field);
        if (errEl) { errEl.textContent = errors[field]; show(errEl); }
      });

      // Mirror the missing/invalid fields into a summary line right above
      // the Submit button so authors who've scrolled past the per-field
      // errors can still tell at a glance what's blocking submission.
      var missingSummary = $('#submit-form__missing-summary');
      var missingList = $('#submit-form__missing-list');
      if (missingSummary && missingList) {
        var keys = Object.keys(errors);
        if (keys.length === 0) {
          hide(missingSummary);
        } else {
          missingList.textContent = keys.map(function (k) {
            return FIELD_LABELS[k] || k;
          }).join(', ');
          show(missingSummary);
        }
      }

      var submitBtn = $('#submit-form__submit-btn');
      if (submitBtn) submitBtn.disabled = Validate.hasErrors(errors);

      return errors;
    },

    showFormError: function (msg) {
      var el = $('#submit-form__form-error');
      if (el) { el.textContent = msg; show(el); }
    },

    clearFormError: function () {
      var el = $('#submit-form__form-error');
      if (el) { el.textContent = ''; hide(el); }
    },

    onSubmit: async function () {
      if (this.submitting) return;
      this.clearFormError();

      var fm = this.readFieldsToFrontmatter();
      var errors = this.revalidate();
      if (Validate.hasErrors(errors)) {
        this.showFormError('Please fix the validation errors above.');
        return;
      }

      this.submitting = true;
      var submitBtn = $('#submit-form__submit-btn');
      if (submitBtn) submitBtn.disabled = true;
      Progress.reset();

      var state = {};

      try {
        // Determine post ID (existing post in update mode, otherwise allocate fresh)
        if (UpdateMode.active) {
          this.postId = UpdateMode.postId;
        } else {
          this.postId = await PostID.getNext();
        }
        fm.post_id = this.postId;

        // Featured image: if user uploaded images and frontmatter has image, check if it matches.
        // In update mode, an existing image of that name kept from the published version also counts.
        if (fm.image && ImageHandler.files.length) {
          var found = ImageHandler.files.some(function (f) {
            return ImageHandler.sanitizeName(f.name) === fm.image || f.name === fm.image;
          });
          if (!found && UpdateMode.active) {
            found = UpdateMode.existingFiles.some(function (f) {
              return !UpdateMode.removedExistingImages[f.name] && f.name === fm.image;
            });
          }
          if (!found) fm.image = '';
        }

        // Pull markdown from the editor — it already prepends the summary as
        // a {{< summary >}} shortcode when one is present. Falls back to the
        // hidden textareas if the editor module failed to load.
        var rawBody;
        if (window.SubmissionEditor && typeof window.SubmissionEditor.getMarkdown === 'function') {
          rawBody = window.SubmissionEditor.getMarkdown();
        } else {
          var bodyInput = $('#submit-form__body-input');
          var summaryInput = $('#submit-form__summary-input');
          var rawBodyOnly = bodyInput ? (bodyInput.value || '') : (this.parsed ? this.parsed.body : '');
          var rawSummary = summaryInput ? (summaryInput.value || '').trim() : '';
          rawBody = rawSummary
            ? '{{< summary >}}\n\n' + rawSummary + '\n\n{{< /summary >}}\n\n' + rawBodyOnly
            : rawBodyOnly;
        }
        var body = MarkdownGen.expandImageKeywords(rawBody);
        var mdContent = MarkdownGen.generate(fm, body);
        var branchName = UpdateMode.active
          ? 'update/' + this.postId + '-rev-' + fm.revision
          : 'blog/' + this.postId;

        // Step 1: Fork
        Progress.setStep(0);
        var fork = await GitHubAPI.forkRepo();
        state.forkOwner = fork.owner.login;

        // Wait for fork to be ready (GitHub needs a moment)
        await new Promise(function (resolve) { setTimeout(resolve, 3000); });

        // Sync fork with upstream
        try { await GitHubAPI.syncFork(state.forkOwner); } catch (e) { /* may fail if fork is fresh */ }

        Progress.complete(0);

        // Step 2: Create branch
        Progress.setStep(1);
        var mainRef = await GitHubAPI.getRef(state.forkOwner, CONFIG.DEFAULT_BRANCH);
        state.baseSha = mainRef.object.sha;

        // Check if branch already exists and delete it
        try {
          await GitHubAPI.getRef(state.forkOwner, branchName);
          await GitHubAPI.deleteRef(state.forkOwner, branchName);
        } catch (e) { /* branch doesn't exist, good */ }

        await GitHubAPI.createRef(state.forkOwner, branchName, state.baseSha);
        Progress.complete(1);

        // Step 3: Upload files as blobs
        Progress.setStep(2);
        var treeItems = [];
        var blogDir = CONFIG.BLOGS_PATH + '/' + this.postId;

        // index.md blob
        var mdBlob = await GitHubAPI.createBlob(state.forkOwner, btoa(unescape(encodeURIComponent(mdContent))), 'base64');
        treeItems.push({ path: blogDir + '/index.md', mode: '100644', type: 'blob', sha: mdBlob.sha });

        // Image blobs (parallel)
        var imagePromises = ImageHandler.files.map(async function (file) {
          var base64 = await ImageHandler.readAsBase64(file);
          var blob = await GitHubAPI.createBlob(state.forkOwner, base64, 'base64');
          return { path: blogDir + '/' + ImageHandler.sanitizeName(file.name), mode: '100644', type: 'blob', sha: blob.sha };
        });
        var imageItems = await Promise.all(imagePromises);
        treeItems = treeItems.concat(imageItems);

        // Update mode: keep existing images by SHA reference, delete any the
        // user toggled off (or in "blank" mode, delete every non-uploaded file).
        if (UpdateMode.active) {
          var newNames = ImageHandler.files.map(function (f) { return ImageHandler.sanitizeName(f.name); });
          var existingItems = UpdateMode.buildExistingFileTreeItems(newNames);
          // Existing items first; uploaded items already in treeItems will win
          // on conflict because they appear later in the tree array sent to
          // GitHub's /git/trees endpoint.
          treeItems = existingItems.concat(treeItems);
        }
        Progress.complete(2);

        // Step 4: Create tree and commit
        Progress.setStep(3);
        // Get the base tree SHA
        var baseCommit = await GitHubAPI.request('GET', '/repos/' + state.forkOwner + '/' + CONFIG.REPO + '/git/commits/' + state.baseSha);
        var tree = await GitHubAPI.createTree(state.forkOwner, baseCommit.tree.sha, treeItems);
        var commitMsg = UpdateMode.active
          ? 'Update blog post ' + this.postId + ' (rev ' + fm.revision + '): ' + fm.title
          : 'Add blog post ' + this.postId + ': ' + fm.title;
        var commit = await GitHubAPI.createCommit(
          state.forkOwner,
          commitMsg,
          tree.sha,
          [state.baseSha]
        );
        await GitHubAPI.updateRef(state.forkOwner, branchName, commit.sha);
        Progress.complete(3);

        // Step 5: Create PR
        Progress.setStep(4);
        var prTitle, prBody;
        if (UpdateMode.active) {
          var origSubmitter = (UpdateMode.existingFrontmatter && UpdateMode.existingFrontmatter.submitter_github) || this.user.login;
          var prevRev = (parseInt(UpdateMode.existingFrontmatter && UpdateMode.existingFrontmatter.revision, 10) || 1);
          prTitle = 'Update ' + this.postId + ' rev ' + fm.revision + ': ' + fm.title;
          prBody =
            '# Blog Post Update (rev ' + fm.revision + ')\n\n' +
            '- [x] Updates an existing post: [`' + this.postId + '`](https://github.com/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/blob/' + CONFIG.DEFAULT_BRANCH + '/' + CONFIG.BLOGS_PATH + '/' + this.postId + '/index.md)\n' +
            '- [ ] Content follows [submission guidelines](https://genomicsxai.github.io/submission-guidelines/)\n' +
            '- [ ] Lab review completed\n' +
            '- [ ] Links and assets validated\n\n' +
            '## Revision notes\n' +
            (UpdateMode.notes || '(none provided)') + '\n\n' +
            '## Notes for Editors\n' +
            'Submitted via the web form by @' + this.user.login + '.\n' +
            'Original submitter: @' + origSubmitter + '.\n' +
            'Post ID: ' + this.postId + ' (rev ' + prevRev + ' → ' + fm.revision + ').\n';
        } else {
          prTitle = 'Blog post ' + this.postId + ': ' + fm.title;
          prBody =
            '# Blog Post Submission\n\n' +
            '- [x] Post uses the [blog post template](https://github.com/genomicsxai/genomicsxai.github.io/blob/main/docs/blog-post-template.md) and required frontmatter is complete\n' +
            '- [ ] Content follows [submission guidelines](https://genomicsxai.github.io/submission-guidelines/)\n' +
            '- [ ] Lab review completed\n' +
            '- [ ] Links and assets validated\n\n' +
            '## Notes for Editors\n' +
            'Submitted via the web form by @' + this.user.login + '.\n' +
            'Post ID: ' + this.postId + '\n';
        }

        var pr = await GitHubAPI.createPR(
          state.forkOwner + ':' + branchName,
          prTitle,
          prBody
        );
        Progress.complete(4);

        // Show success
        this.showSuccess(pr.html_url, pr.number);
        this.pollForPreview(pr.number);

      } catch (e) {
        Progress.showError(e.message);
        this.showFormError('Submission failed: ' + e.message);
      } finally {
        this.submitting = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    },

    showSuccess: function (prUrl, prNumber) {
      var el = $('#submit-form__success');
      if (el) {
        el.innerHTML =
          '<strong>Submission successful!</strong> ' +
          'Your pull request has been created: <a href="' + prUrl + '" target="_blank" rel="noopener">PR #' + prNumber + '</a>.<br>' +
          '<span id="submit-form__preview-status">Building a live preview of your post — this usually takes 1–3 minutes.</span>';
        show(el);
      }
      hide($('#submit-form__actions'));
    },

    pollForPreview: async function (prNumber) {
      var maxAttempts = 30; // ~5 minutes at 10s intervals
      var statusEl = function () { return $('#submit-form__preview-status'); };
      for (var i = 0; i < maxAttempts; i++) {
        await new Promise(function (r) { setTimeout(r, 10000); });
        try {
          var comments = await GitHubAPI.request(
            'GET',
            '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/issues/' + prNumber + '/comments'
          );
          for (var j = 0; j < comments.length; j++) {
            var c = comments[j];
            if (c.user && c.user.login === 'github-actions[bot]' && c.body && /Preview URL/i.test(c.body)) {
              var match = c.body.match(/https?:\/\/[^\s)]+\/previews\/pr-\d+\/?/);
              if (match) {
                var s = statusEl();
                if (s) {
                  s.innerHTML =
                    'Live preview is ready: <a href="' + match[0] + '" target="_blank" rel="noopener">' + match[0] + '</a>';
                }
                return;
              }
            }
          }
        } catch (e) {
          // Ignore transient errors and keep polling
        }
      }
      var s = statusEl();
      if (s) {
        s.innerHTML =
          'Preview is taking longer than usual. Check the <a href="https://github.com/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/pull/' + prNumber + '" target="_blank" rel="noopener">PR comments</a> for the preview link.';
      }
    },
  };

  // ── Init ──
  document.addEventListener('DOMContentLoaded', function () {
    // Bind the "Add author" button (static element)
    var addAuthorBtn = $('#sf-add-author');
    if (addAuthorBtn) {
      addAuthorBtn.addEventListener('click', function () { FormController.addAuthorRow(); });
    }

    FormController.init();

    // Expose internals so submission-editor.js (loaded alongside) can resolve
    // image sources and route pasted Word images into ImageHandler. No load
    // order coupling beyond "both scripts run by DOMContentLoaded".
    window.__submitForm = {
      ImageHandler: ImageHandler,
      UpdateMode: UpdateMode,
      CONFIG: CONFIG,
      FormController: FormController,
    };
  });
})();

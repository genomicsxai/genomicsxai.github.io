/* submission-editor.js
 *
 * Mounts two TinyMCE 7 (community, MIT) WYSIWYG editors — Summary + Body —
 * on the submission form, and keeps a pair of hidden <textarea>s in sync with
 * their Markdown serialization so the rest of the submission pipeline
 * (submission-form.js) keeps reading plain Markdown out of the textareas the
 * way it always has.
 *
 * Storage contract (unchanged): posts on disk are Markdown. The submission
 * pipeline reads:
 *   - #submit-form__summary-input  (Markdown summary, may be empty)
 *   - #submit-form__body-input     (Markdown body)
 * This module owns both editors and the conversion both directions.
 *
 * Image placeholders survive the HTML↔MD round-trip via a custom Turndown rule
 * (figure[data-image] ↔ [image: filename | caption]) and a Markdown pre-pass
 * that turns the bracket syntax into figure elements before Marked sees it.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // Wait until the DOM and the three CDN libs are ready. The form shortcode
  // loads tinymce/turndown/marked synchronously above this script, so by the
  // time we run, all three should be on `window`. We still guard against
  // a misconfigured page (logs once and bails so the rest of the form still
  // functions on the raw textareas as a fallback).
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.tinymce || !window.TurndownService || !window.marked || !window.katex) {
      console.warn('[submission-editor] tinymce/turndown/marked/katex not loaded — falling back to plain textareas.');
      // Make sure the hidden textareas are visible so the user can still type.
      var bodyTa = document.getElementById('submit-form__body-input');
      var summaryTa = document.getElementById('submit-form__summary-input');
      if (bodyTa) bodyTa.removeAttribute('hidden');
      if (summaryTa) summaryTa.removeAttribute('hidden');
      return;
    }
    SubmissionEditor.init();
  });

  // ── HTML ↔ Markdown ──────────────────────────────────────────────────────
  // Configured once and reused for every change event.
  var turndown = null;
  function getTurndown() {
    if (turndown) return turndown;
    turndown = new window.TurndownService({
      headingStyle: 'atx',          // "## Heading", not "Heading\n----"
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
    });
    // Preserve our image placeholder. Authors see a real <figure> with caption
    // inside TinyMCE; on serialize we emit "[image: filename | caption]" so the
    // rest of the pipeline (expandImageKeywords in submission-form.js) keeps
    // working unchanged.
    turndown.addRule('imagePlaceholder', {
      filter: function (node) {
        return node.nodeName === 'FIGURE' && node.getAttribute('data-image');
      },
      replacement: function (_content, node) {
        var filename = (node.getAttribute('data-image') || '').toLowerCase();
        var capEl = node.querySelector('figcaption');
        var caption = capEl ? capEl.textContent.trim() : '';
        return caption
          ? '\n\n[image: ' + filename + ' | ' + caption + ']\n\n'
          : '\n\n[image: ' + filename + ']\n\n';
      },
    });
    // Math chips round-trip via their data-tex attribute, which holds the
    // original LaTeX source. The KaTeX-rendered HTML inside the chip is
    // for display only and isn't serialized back.
    turndown.addRule('blockMath', {
      filter: function (node) {
        return (node.nodeName === 'DIV' || node.nodeName === 'FIGURE') &&
          node.getAttribute('data-math') === 'block';
      },
      replacement: function (_content, node) {
        var tex = node.getAttribute('data-tex') || node.textContent || '';
        return '\n\n$$' + tex.trim() + '$$\n\n';
      },
    });
    turndown.addRule('inlineMath', {
      filter: function (node) {
        return node.nodeName === 'SPAN' && node.getAttribute('data-math') === 'inline';
      },
      replacement: function (_content, node) {
        var tex = node.getAttribute('data-tex') || node.textContent || '';
        return '$' + tex.trim() + '$';
      },
    });
    // GFM pipe-table converter. TinyMCE\'s table plugin emits standard
    // <table><tbody>...</tbody></table>; Turndown\'s default leaves that
    // as raw HTML in the markdown output, which Hugo\'s goldmark/GFM
    // renders inconsistently (often broken if the block ends up adjacent
    // to a paragraph). Emit a proper pipe-table block so the published
    // post gets the same styled table a hand-written |---|---| would.
    turndown.addRule('gfmTable', {
      filter: 'table',
      replacement: function (_content, node) { return convertTableToGfm(node); },
    });
    return turndown;
  }

  // Walk an HTML <table> and emit a GFM pipe-table block. First row
  // becomes the header; the rest become body rows; the separator runs
  // the full cell-count width. Cell content is run back through the
  // shared Turndown instance so inline formatting (bold/italic/code/
  // links) survives — collapsed to a single line and pipe-escaped so
  // the cell stays inside its `| ... |` boundary.
  function convertTableToGfm(table) {
    var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
    if (rows.length === 0) return '';

    var cellCount = 0;
    rows.forEach(function (row) {
      var cells = row.querySelectorAll('td, th');
      if (cells.length > cellCount) cellCount = cells.length;
    });
    if (cellCount === 0) return '';

    function cellMd(cell) {
      // Nested <table> inside a cell can\'t round-trip to a pipe table
      // (GFM has no nested-table syntax); flatten to text so we don\'t
      // recurse into an invalid construct.
      if (cell.querySelector('table')) {
        return (cell.textContent || '')
          .replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
      }
      var md = getTurndown().turndown(cell.innerHTML || '');
      return md
        .replace(/\|/g, '\\|')
        .replace(/\r?\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function rowMd(row) {
      var cells = Array.prototype.slice.call(row.querySelectorAll('td, th'));
      var parts = [];
      for (var i = 0; i < cellCount; i++) {
        parts.push(cells[i] ? cellMd(cells[i]) : '');
      }
      return '| ' + parts.join(' | ') + ' |';
    }

    var lines = [rowMd(rows[0])];
    var seps = [];
    for (var k = 0; k < cellCount; k++) seps.push('---');
    lines.push('| ' + seps.join(' | ') + ' |');
    for (var j = 1; j < rows.length; j++) {
      lines.push(rowMd(rows[j]));
    }
    return '\n\n' + lines.join('\n') + '\n\n';
  }

  // ── LaTeX math rendering ─────────────────────────────────────────────────
  // KaTeX renders the chip HTML; the original source is preserved on
  // data-tex so the Turndown rules above can round-trip back to $...$ /
  // $$...$$ markdown unchanged.
  function renderMathChip(tex, displayMode) {
    var html;
    try {
      html = window.katex.renderToString(tex, {
        displayMode: !!displayMode,
        throwOnError: false,
        strict: 'ignore',
        // Emit semantic MathML and let the browser render it natively
        // (Chrome 109+, Safari, Firefox). KaTeX's HTML output uses
        // top:-Xem offsets that rely on strut elements to push the
        // line-box; inside TinyMCE's iframe those struts don't end up
        // tall enough and superscripts paint above the chip. MathML
        // avoids that whole chain — slightly different glyphs from the
        // published post, but always positioned correctly.
        output: 'mathml',
      });
    } catch (e) {
      // Defensive: throwOnError:false should keep KaTeX from throwing,
      // but if anything else goes wrong show the raw source so the author
      // can still see and fix their input.
      html = '<span class="sf-math-error">' + escapeHtml(tex) + '</span>';
    }
    var tag = displayMode ? 'div' : 'span';
    var cls = displayMode ? 'sf-math sf-math--block' : 'sf-math sf-math--inline';
    var dm = displayMode ? 'block' : 'inline';
    return (
      '<' + tag + ' class="' + cls + '" data-math="' + dm + '" ' +
      'data-tex="' + escapeAttr(tex) + '" contenteditable="false">' +
      html +
      '</' + tag + '>'
    );
  }

  // Marked v13 extension: tokenise inline $...$ and block $$...$$ before
  // they reach the default text renderer (which would otherwise emit them
  // as literal characters — the root cause of #69).
  //
  // Inline rule requires non-whitespace adjacent to both delimiters so we
  // don't trigger on prices ($5) or stray dollar signs. Block rule is
  // greedy across newlines.
  function registerMarkedMathExtension() {
    if (!window.marked || !window.marked.use) return;
    if (window.marked.__sfMathRegistered) return;
    window.marked.__sfMathRegistered = true;
    window.marked.use({
      extensions: [
        {
          name: 'sfBlockMath',
          level: 'block',
          start: function (src) { var i = src.indexOf('$$'); return i < 0 ? undefined : i; },
          tokenizer: function (src) {
            var m = /^\$\$([\s\S]+?)\$\$\s*/.exec(src);
            if (!m) return undefined;
            return { type: 'sfBlockMath', raw: m[0], tex: m[1].trim() };
          },
          renderer: function (token) { return renderMathChip(token.tex, true); },
        },
        {
          name: 'sfInlineMath',
          level: 'inline',
          start: function (src) { var i = src.indexOf('$'); return i < 0 ? undefined : i; },
          tokenizer: function (src) {
            // $...$ where both edges are non-whitespace; reject $$ (block).
            var m = /^\$(?!\$)((?:[^\s$][^$\n]*?[^\s$])|(?:[^\s$\n]))\$/.exec(src);
            if (!m) return undefined;
            return { type: 'sfInlineMath', raw: m[0], tex: m[1] };
          },
          renderer: function (token) { return renderMathChip(token.tex, false); },
        },
      ],
    });
  }

  function htmlToMarkdown(html) {
    if (!html) return '';
    return getTurndown().turndown(html).trim();
  }

  // Render an image placeholder as a compact non-editable chip rather than
  // a full-size figure. The chip is just a reference to the image (icon +
  // filename + caption) — the actual image only appears on the published
  // page. No <img> tag inside, so TinyMCE doesn't mistake it for an
  // uploadable asset.
  function buildImageChip(filename, caption) {
    var cap = (caption || '').trim();
    return (
      '<figure data-image="' + escapeAttr(filename) + '" contenteditable="false">' +
      '<span data-image-icon>&#128247;</span>' +
      '<span data-image-name>' + escapeHtml(filename) + '</span>' +
      (cap ? '<figcaption>' + escapeHtml(cap) + '</figcaption>' : '<figcaption></figcaption>') +
      '</figure>'
    );
  }

  // Pre-pass: turn our bracket syntax into <figure> chips before marked
  // parses the markdown.
  function expandImagePlaceholdersToFigures(md) {
    return (md || '').replace(
      /\[image:\s*([a-z0-9._-]+)\s*(?:\|\s*([^\]]*?)\s*)?\]/gi,
      function (_m, filename, caption) {
        return buildImageChip(filename, caption);
      }
    );
  }

  function markdownToHtml(md) {
    if (!md) return '';
    var withFigures = expandImagePlaceholdersToFigures(md);
    // marked v13 is sync by default.
    return window.marked.parse(withFigures, { gfm: true, breaks: false });
  }

  // ── Image src resolution ─────────────────────────────────────────────────
  // For images the user just uploaded we have an in-memory File and can
  // create a blob URL. For existing images (update mode), point to raw
  // GitHub so the editor preview looks right. ImageHandler/UpdateMode live
  // in submission-form.js, but we read them off `window.__submitForm` (set
  // by submission-form.js) so we don't introduce a hard load order coupling.
  function resolveImageSrc(filename) {
    var refs = window.__submitForm || {};
    var clean = (filename || '').toLowerCase();
    var ImageHandler = refs.ImageHandler;
    if (ImageHandler && Array.isArray(ImageHandler.files)) {
      for (var i = 0; i < ImageHandler.files.length; i++) {
        var f = ImageHandler.files[i];
        if (ImageHandler.sanitizeName(f.name) === clean) {
          return URL.createObjectURL(f);
        }
      }
    }
    var UpdateMode = refs.UpdateMode;
    var CONFIG = refs.CONFIG;
    if (UpdateMode && UpdateMode.active && UpdateMode.postId && CONFIG) {
      return 'https://raw.githubusercontent.com/' + CONFIG.OWNER + '/' + CONFIG.REPO +
        '/' + CONFIG.DEFAULT_BRANCH + '/' + CONFIG.BLOGS_PATH + '/' +
        UpdateMode.postId + '/' + encodeURIComponent(filename);
    }
    // Fallback — broken image is fine, the placeholder still serializes back
    // to [image: filename] on save.
    return filename;
  }

  function escapeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Summary / body composition ───────────────────────────────────────────
  // On the disk, the summary lives inside the body as a Hugo shortcode:
  //   {{< summary >}} ... {{< /summary >}}
  // The editor separates them into two fields. These helpers handle the
  // split (on load) and the recombine (on save).
  var SUMMARY_RE = /\{\{<\s*summary\s*>\}\}([\s\S]*?)\{\{<\s*\/\s*summary\s*>\}\}\s*/i;

  function splitSummary(md) {
    var match = (md || '').match(SUMMARY_RE);
    if (!match) return { summary: '', body: md || '' };
    var summary = (match[1] || '').trim();
    var body = (md || '').replace(SUMMARY_RE, '').trim();
    return { summary: summary, body: body };
  }

  function composeWithSummary(summaryMd, bodyMd) {
    var s = (summaryMd || '').trim();
    var b = (bodyMd || '').trim();
    if (!s) return b;
    return '{{< summary >}}\n\n' + s + '\n\n{{< /summary >}}\n\n' + b;
  }

  // ── SubmissionEditor — public surface ────────────────────────────────────
  var SubmissionEditor = {
    summary: null,   // TinyMCE editor instance
    body: null,      // TinyMCE editor instance

    init: function () {
      var self = this;
      // Configure marked once (idempotent).
      if (window.marked && window.marked.setOptions) {
        window.marked.setOptions({ gfm: true, breaks: false });
      }
      // Register the $...$ / $$...$$ extension so math tokens become
      // KaTeX-rendered chips instead of literal text.
      registerMarkedMathExtension();
      this._initEditor('#submit-form__summary-editor', { isSummary: true })
        .then(function (ed) { self.summary = ed; });
      this._initEditor('#submit-form__body-editor', { isSummary: false })
        .then(function (ed) { self.body = ed; });

      // Expose so submission-form.js can call us.
      window.SubmissionEditor = self;
    },

    _initEditor: function (selector, opts) {
      var self = this;
      return window.tinymce.init({
        selector: selector,
        // Self-hosted-style config: the CDN base is auto-detected from the
        // <script> tag, so we don't need to set baseURL.
        license_key: 'gpl',  // TinyMCE 7 community runs under GPL; suppress
                             // the "no API key" banner.
        promotion: false,
        branding: false,
        menubar: false,
        statusbar: false,
        // Allow MathML elements through TinyMCE's content filter. Without
        // these, KaTeX's <math>...<mi>E</mi>...<msup><mi>c</mi><mn>2</mn>
        // </msup>...</math> gets reduced to the inner text content
        // ("E=mc2E=mc^2" — the second half being the <annotation> source)
        // because TinyMCE strips elements it doesn't know about.
        // custom_elements registers the tag names; ~ marks them as inline
        // (no auto-block-wrap). extended_valid_elements lets every
        // attribute through so KaTeX's inline styles/classes survive.
        custom_elements:
          '~math,~semantics,~mrow,~mi,~mo,~mn,~ms,~mtext,~mspace,' +
          '~mfrac,~msqrt,~mroot,~msup,~msub,~msubsup,~mover,~munder,' +
          '~munderover,~mtable,~mtr,~mtd,~mphantom,~menclose,~mpadded,' +
          '~annotation,~annotation-xml',
        extended_valid_elements:
          'math[*],semantics[*],mrow[*],mi[*],mo[*],mn[*],ms[*],mtext[*],' +
          'mspace[*],mfrac[*],msqrt[*],mroot[*],msup[*],msub[*],msubsup[*],' +
          'mover[*],munder[*],munderover[*],mtable[*],mtr[*],mtd[*],' +
          'mphantom[*],menclose[*],mpadded[*],annotation[*],annotation-xml[*]',
        height: opts.isSummary ? 180 : 480,
        min_height: opts.isSummary ? 120 : 320,
        plugins: 'lists link autolink table codesample paste autoresize wordcount',
        // `codesample` = block code with language picker (round-trips as a
        // fenced ```lang block).
        // `inlinecode` = our custom button defined below; toggles <code> on
        // the selection (round-trips as `backticks`).
        toolbar: opts.isSummary
          ? 'undo redo | bold italic inlinecode | link | bullist numlist | removeformat'
          : 'undo redo | blocks | bold italic inlinecode | bullist numlist | link table | blockquote codesample | removeformat',
        // Language list for the codesample picker — tuned to what genomics×AI
        // authors actually paste. Add more here as the need comes up.
        codesample_languages: [
          { text: 'Python', value: 'python' },
          { text: 'R', value: 'r' },
          { text: 'Bash / Shell', value: 'bash' },
          { text: 'JavaScript', value: 'javascript' },
          { text: 'TypeScript', value: 'typescript' },
          { text: 'YAML', value: 'yaml' },
          { text: 'JSON', value: 'json' },
          { text: 'SQL', value: 'sql' },
          { text: 'Markdown', value: 'markdown' },
          { text: 'Plain text', value: 'text' },
        ],
        // Pull KaTeX's stylesheet into the iframe so the rendered math
        // chips look identical to the published post.
        content_css: ['https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'],
        // Style the image-reference chip inside the editor iframe. The chip
        // is just an inline marker for "an image will go here" — the actual
        // figure only renders on the published page.
        content_style:
          'figure[data-image]{display:inline-block;padding:4px 12px;margin:6px 4px;background:#eef2f7;' +
          'border:1px dashed #b4c2d4;border-radius:14px;font-size:13px;color:#2a4d80;' +
          'line-height:1.4;cursor:default;-webkit-user-select:none;user-select:none;}' +
          'figure[data-image] img{display:none;}' +
          'figure[data-image] [data-image-icon]{margin-right:6px;}' +
          'figure[data-image] [data-image-name]{font-weight:600;}' +
          'figure[data-image] figcaption{display:inline;margin-left:8px;font-style:italic;color:#5a7090;font-weight:400;}' +
          'figure[data-image] figcaption:empty{display:none;}' +
          // Code block + inline code styling — matches the on-page look closely
          // enough that authors can tell what is and isn\'t code.
          'pre{background:#f5f7fa;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;' +
          'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;' +
          'line-height:1.5;overflow-x:auto;}' +
          'pre code{background:transparent;border:0;padding:0;color:inherit;}' +
          'code{background:#f1f3f5;border:1px solid #e2e8f0;border-radius:3px;padding:1px 5px;' +
          'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.92em;color:#b13a5e;}' +
          // Math chip styling — atomic, non-editable, visually distinct from
          // surrounding prose so authors can see where math lives. Click-to-
          // delete works as normal; the chip round-trips via its data-tex
          // attribute (see turndown rules above). MathML inside the chip
          // sizes itself correctly, so the chip just needs a styled box.
          '.sf-math{background:#fffbeb;border:1px solid #fde68a;border-radius:4px;' +
          'cursor:default;-webkit-user-select:none;user-select:none;}' +
          '.sf-math--inline{display:inline-block;padding:2px 6px;margin:0 2px;' +
          'vertical-align:middle;}' +
          '.sf-math--block{display:block;text-align:center;padding:6px 12px;' +
          'margin:14px auto;}' +
          '.sf-math math{font-size:1.1em;}' +
          // Annotations carry the LaTeX source for round-tripping; browsers
          // that fully render MathML hide them automatically inside
          // <semantics>, but force it for any that don\'t.
          '.sf-math annotation,.sf-math annotation-xml{display:none;}' +
          '.sf-math-error{color:#b91c1c;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.9em;}',
        // Tighten paste cleanup. TinyMCE handles MS Word / Google Docs by
        // default; these toggles strip extra inline styles so the markdown
        // round-trip is clean.
        paste_as_text: false,
        paste_data_images: true,
        paste_remove_styles_if_webkit: true,
        paste_webkit_styles: 'none',
        paste_merge_formats: true,
        // Pasted Word images come through as data: URLs. We turn them into
        // real File objects and hand them to ImageHandler so they ship with
        // the PR. The figure[data-image] node makes them round-trip cleanly.
        images_upload_handler: function (blobInfo) {
          return new Promise(function (resolve) {
            try {
              var refs = window.__submitForm || {};
              var ImageHandler = refs.ImageHandler;
              if (!ImageHandler) { resolve(blobInfo.blobUri()); return; }
              var name = blobInfo.filename();
              if (!/\.[a-z0-9]+$/i.test(name)) name += '.png';
              var file = new File([blobInfo.blob()], name, { type: blobInfo.blob().type });
              ImageHandler.addFiles([file]);
              ImageHandler.renderPreviews();
              var clean = ImageHandler.sanitizeName(file.name);
              resolve(URL.createObjectURL(file));
              // Tag the inserted <img> so the figure rule picks it up. TinyMCE
              // wraps the image in a paragraph; we upgrade it to a figure after
              // the insert lands.
              setTimeout(function () { self._upgradeBareImageToFigure(clean); }, 50);
            } catch (e) {
              console.warn('[submission-editor] image paste failed:', e);
              resolve(blobInfo.blobUri());
            }
          });
        },
        // Hook into editor lifecycle.
        setup: function (editor) {
          // Custom "Inline code" toolbar button — wraps the selection in
          // <code>…</code>, which Turndown emits as `backticks`.
          editor.ui.registry.addToggleButton('inlinecode', {
            icon: 'sourcecode',
            tooltip: 'Inline code',
            onAction: function () {
              editor.execCommand('mceToggleFormat', false, 'code');
            },
            onSetup: function (api) {
              var unbind = editor.formatter.formatChanged('code', function (state) {
                api.setActive(state);
              });
              return function () { if (unbind && unbind.unbind) unbind.unbind(); };
            },
          });

          editor.on('init', function () {
            if (opts.isSummary) {
              editor.getBody().setAttribute('data-placeholder',
                'A short overview of your post (optional).');
            }
          });
          editor.on('input change keyup undo redo blur SetContent', function () {
            self._syncToTextarea(editor, opts.isSummary);
          });
          // Re-parse the markdown on blur so any $...$ / $$...$$ the user
          // just typed becomes a KaTeX-rendered chip. The first handler
          // above has already synced the latest markdown to the textarea
          // by the time this fires, so we can read straight from it.
          editor.on('blur', function () {
            self._rerenderMath(editor, opts.isSummary);
          });
        },
      }).then(function (editors) {
        // tinymce.init resolves with an array of editor instances.
        return editors && editors[0];
      });
    },

    // Replace any bare <img> the user just pasted with our compact chip.
    // Called from images_upload_handler after a paste; the filename arg is
    // the one we just registered with ImageHandler.
    _upgradeBareImageToFigure: function (filename) {
      if (!this.body) return;
      var doc = this.body.getDoc();
      if (!doc) return;
      var imgs = doc.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (img.closest('figure[data-image]')) continue;
        var wrap = doc.createElement('div');
        wrap.innerHTML = buildImageChip(filename, '');
        var chip = wrap.firstChild;
        img.parentNode.replaceChild(chip, img);
      }
      this._syncToTextarea(this.body, false);
    },

    _syncToTextarea: function (editor, isSummary) {
      var html = editor.getContent();
      var md = htmlToMarkdown(html);
      var ta = document.getElementById(
        isSummary ? 'submit-form__summary-input' : 'submit-form__body-input'
      );
      if (ta) ta.value = md;
      // Body/summary aren't validated as required, but re-running revalidate
      // keeps the submit button's enabled state coherent.
      var refs = window.__submitForm || {};
      if (refs.FormController && typeof refs.FormController.revalidate === 'function') {
        try { refs.FormController.revalidate(); } catch (_) { /* ignore */ }
      }
    },

    // Re-parse the textarea's markdown back to HTML so any newly-typed
    // $...$ / $$...$$ that's still sitting as literal text becomes a
    // KaTeX-rendered chip. Called on editor blur. Skipped when the
    // markdown has no $ — almost all blurs in practice.
    _rerenderMath: function (editor, isSummary) {
      if (!editor) return;
      var ta = document.getElementById(
        isSummary ? 'submit-form__summary-input' : 'submit-form__body-input'
      );
      if (!ta) return;
      var md = ta.value || '';
      if (md.indexOf('$') < 0) return;
      var newHtml = markdownToHtml(md);
      if (newHtml === editor.getContent()) return;
      editor.setContent(newHtml);
    },

    // ── Public API used by submission-form.js ──────────────────────────────

    // Replace both editors' contents from a markdown blob. Used by
    // loadMarkdownFile, UpdateMode prefill, and startBlank('').
    setMarkdown: function (md) {
      var parts = splitSummary(md || '');
      if (this.summary) this.summary.setContent(markdownToHtml(parts.summary));
      if (this.body) this.body.setContent(markdownToHtml(parts.body));
      // Force a sync so the hidden textareas catch up before any validation.
      if (this.summary) this._syncToTextarea(this.summary, true);
      if (this.body) this._syncToTextarea(this.body, false);
    },

    // Read the current body, with summary prepended as a {{< summary >}}
    // shortcode if any. Called by onSubmit just before building the PR.
    getMarkdown: function () {
      var summaryTa = document.getElementById('submit-form__summary-input');
      var bodyTa = document.getElementById('submit-form__body-input');
      return composeWithSummary(
        summaryTa ? summaryTa.value : '',
        bodyTa ? bodyTa.value : ''
      );
    },

    // Insert an image reference chip at the cursor in the body editor.
    // filename is already sanitized; caption may be empty.
    insertImage: function (filename, caption) {
      if (!this.body) return;
      this.body.focus();
      this.body.insertContent(buildImageChip(filename, caption) + '<p></p>');
      this._syncToTextarea(this.body, false);
    },
  };
})();

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scientific blogging platform for the "Genomics × AI" community. Built with Hugo (Stack theme) and deployed to GitHub Pages via GitHub Actions. Content is peer-reviewed through GitHub PRs, and comments/likes use Giscus backed by GitHub Discussions.

## Commands

- **Dev server**: `hugo server`
- **Build**: `hugo --minify`
- **Validate blog frontmatter**: `bash .github/scripts/validate-blog.sh`

Hugo requires the theme submodule. After a fresh clone: `git submodule update --init --recursive`

CI pins Hugo to 0.169.0 (the last extended release). Hugo 0.170 removed LibSass, which the Stack theme's SCSS needs, so upgrading means installing Dart Sass in every workflow too.

## Architecture

### Content

Blog posts live in `content/blogs/YYYY-NNN/index.md` (e.g., `2026-002/index.md`). Each post directory can contain colocated images.

Every post is written in Markdown. A post can add an optional **PDF version**, such as the paper it reports: front matter `pdf: "paper.pdf"` naming a PDF (under 5 MB) in the same folder. Its header then offers View PDF and Download PDF buttons, and that PDF replaces the deploy's printout everywhere (Scholar `citation_pdf_url`, Zenodo deposit, sidebar PDF button). Posts made of a PDF alone (`format: "pdf"`) were retired and fail validation. See `docs/BLOG_SPEC.md` §4.8. Static pages (forum, policies, editorial board, submission guidelines) live in `content/page/<section>/index.md`.

### Layouts & Templating

Custom Hugo templates in `layouts/` override the Stack theme (`themes/Stack/`). Key customizations:
- `layouts/blogs/single.html` — Blog post rendering (authors, meta, PDF version buttons, citation, comments)
- `layouts/partials/helper/paper-pdf.html` — Resolves a post's PDF version (URL, size, download name) for every template that offers it
- `layouts/partials/article-meta.html` — Tags, lab, audience, reading time display
- `layouts/partials/article-comments.html` — Giscus comment embedding
- `layouts/partials/citation.html` — BibTeX/RIS citation links
- `layouts/partials/jsonld.html` — JSON-LD structured data for SEO
- `layouts/partials/widget/post-actions.html` — Sidebar discuss/like buttons with counts
- `layouts/shortcodes/editors-list.html` — Renders editorial board from `data/editors.json`

### Data Files

- `data/authors.yaml` — Author profiles (name, affiliation, ORCID)
- `data/blog.yaml` — Blog name, base URL, discussions URL
- `data/editors.json` — Auto-populated from GitHub team `@genomicsxai/editors` during deploy

### Configuration

`config.toml` defines six taxonomies: tags, scope, audience, labs, authors, categories. Homepage sidebar shows taxonomy filters; article sidebar shows post-actions widget and table of contents.

### CI/CD (GitHub Actions)

- **deploy.yml** (push to main): Creates GitHub Discussions per post, fetches discussion metrics (likes/comments), fetches editors from GitHub API, mints Zenodo DOIs, prints each accepted post to PDF for Google Scholar (`.github/scripts/render-post-pdfs.sh`, which builds `hugo --environment pdf` from `config/pdf/` and `layouts/blogs/single.print.html`; posts with their own PDF version are skipped), builds with Hugo, deploys to `gh-pages` branch
- **pr-build.yml**: Runs `hugo --minify` to verify build
- **frontmatter.yml**: Validates YAML frontmatter on PRs touching `content/blogs/`, including a post's PDF version (present, named by `pdf:`, under 5 MB)
- **links.yml**: Checks for broken links with lychee

### Blog Post Frontmatter

Required fields: `post_id`, `title`, `authors`, `editor`, `tags`, `categories`, `scope`, `labs`, `status`, `date`, `date_submitted`, `revision_history`. Optional: `pdf` for a PDF version. See `docs/blog-post-template.md` for the full template and `docs/BLOG_SPEC.md` for the schema spec.

Image width syntax uses Hugo title attribute: `![Alt](img.png "width=400")` — not `{width=400}`.

KaTeX math is enabled: use `$...$` for inline and `$$...$$` for block equations.

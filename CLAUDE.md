# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scientific blogging platform for the "Genomics × AI" community. Built with Hugo (Stack theme) and deployed to GitHub Pages via GitHub Actions. Content is peer-reviewed through GitHub PRs, and comments/likes use Giscus backed by GitHub Discussions.

## Commands

- **Dev server**: `hugo server`
- **Build**: `hugo --minify`
- **Validate blog frontmatter**: `bash .github/scripts/validate-blog.sh`

Hugo requires the theme submodule. After a fresh clone: `git submodule update --init --recursive`

## Architecture

### Content

Blog posts live in `content/blogs/YYYY-NNN/index.md` (e.g., `2026-002/index.md`). Each post directory can contain colocated images.

A post is either a **written post** (the default) or a **PDF post**: front matter `format: "pdf"` plus `pdf: "paper.pdf"` naming a PDF (under 5 MB) in the same folder, with the paper's abstract as the whole body. PDF posts get an arXiv-style abstract page with the PDF embedded below it, and the uploaded PDF replaces the deploy's printout everywhere (Scholar `citation_pdf_url`, Zenodo deposit, sidebar PDF button). See `docs/BLOG_SPEC.md` §4.8 and `docs/pdf-post-template.md`. Static pages (forum, policies, editorial board, submission guidelines) live in `content/page/<section>/index.md`.

### Layouts & Templating

Custom Hugo templates in `layouts/` override the Stack theme (`themes/Stack/`). Key customizations:
- `layouts/blogs/single.html` — Blog post rendering (authors, meta, citation, comments); hands PDF posts to `layouts/partials/paper/landing.html` (abstract page, with `paper/dates.html` and `paper/viewer.html`)
- `layouts/partials/helper/paper-pdf.html` / `paper-cover.html` — Resolve a PDF post's PDF and its first-page cover image for every other template
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

- **deploy.yml** (push to main): Creates GitHub Discussions per post, fetches discussion metrics (likes/comments), fetches editors from GitHub API, mints Zenodo DOIs, prints each accepted written post to PDF for Google Scholar (`.github/scripts/render-post-pdfs.sh`, which builds `hugo --environment pdf` from `config/pdf/` and `layouts/blogs/single.print.html`; PDF posts are skipped), builds with Hugo, deploys to `gh-pages` branch. `.github/scripts/optimize-images.py` also renders each PDF post's first page to a gitignored `<pdf>.cover.png` (pypdfium2) for its card and link preview
- **pr-build.yml**: Runs `hugo --minify` to verify build
- **frontmatter.yml**: Validates YAML frontmatter on PRs touching `content/blogs/`, including a PDF post's PDF (present, named by `pdf:`, under 5 MB)
- **links.yml**: Checks for broken links with lychee

### Blog Post Frontmatter

Required fields: `post_id`, `title`, `authors`, `editor`, `tags`, `categories`, `scope`, `labs`, `status`, `date`, `date_submitted`, `revision_history`. PDF posts add `format: "pdf"` and `pdf`. See `docs/blog-post-template.md` (written posts) and `docs/pdf-post-template.md` (PDF posts) for the full templates and `docs/BLOG_SPEC.md` for the schema spec.

Image width syntax uses Hugo title attribute: `![Alt](img.png "width=400")` — not `{width=400}`.

KaTeX math is enabled: use `$...$` for inline and `$$...$$` for block equations.

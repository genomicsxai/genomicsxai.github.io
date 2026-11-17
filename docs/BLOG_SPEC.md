# Blog specification

**Architecture:** GitHub Pages + Hugo


## 0. Vision

A Git-native, open, reproducible scientific blog for Genomics × AI.

- **GitHub** = backend workflow + state machine  
- **Hugo** = publishing engine (static frontend)  
- **GitHub Pages** = hosting layer  


## 1. System architecture

### 1.1 Core stack

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Workflow backend | GitHub (repo + PR + reviews) | Submission, review, versioning |
| Policy enforcement | GitHub Actions (CI/CD) | Validation, build, deploy |
| Publishing engine | Hugo | Render blog site |
| Hosting | GitHub Pages | Public site delivery |
| Forum | GitHub Discussions | Public community discussion |
| Submission Form | GitHub Oauth App | Automate `.md` file validation + PR creation |


## 2. Roles and permissions

### 2.1 Roles

- **Authors** → Submit and revise posts (PR-based)
- **Editors** → Review via PR comments; only editors can merge to `main`
- **Readers** → View posts and participate in discussion

### 2.2 Access control (GitHub)

- Require PR before merge  
- Require ≥1 approvals  
- Require CI checks  
- Only editors can merge to `main`  

**Implementation:** GitHub branch protection + teams + CODEOWNERS (e.g. `content/blogs/` → @genomicsxai/editors).


## 3. Submission workflow

### 3.1 Submission model

**Submission** = Pull Request that adds:

- `content/blogs/YYYY-NNN/index.md`
- any images it uses, in the same folder
- for a PDF post, the PDF itself, in the same folder (see §4.8)

The PR represents the post under review; **merge** means the post goes live.

**Implementation:** GitHub Pull Requests + PULL_REQUEST_TEMPLATE.


## 4. Blog post content model

### 4.1 Frontmatter

All blogs are submitted as markdown files with any desired images. All markdown files should contain the following frontmatter. A PDF post adds two more fields, `format` and `pdf` (see §4.8).

```markdown
post_id: "2026-001"
title: "Causal Interpretation of Spatial Omics"
# Taxonomy: author slugs for /authors/<slug>/ (Hugo uses plural key)
authors: ["Author Name"]
# Display: full details for citation and JSON-LD (optional; fallback: authors as names)
authors_display:
  - name: "Author Name"
    affiliation: "Institution"
    orcid: "0000-0000-0000-0000"
editor: "Editor Name"
tags: ["genomics", "foundation-models"]
categories: ["Blog Post"]
scope: ["insights"]
audience: ["technical"]
labs: ["Example Lab"]
status: "accepted"
revision: 2
date_submitted: 2026-02-01
date_accepted: 2026-02-17
doi: ""
zenodo_url: ""
revision_history:
  - version: 1
    date: 2026-02-01
    notes: "Initial submission"
    doi: ""
    zenodo_url: ""
  - version: 2
    date: 2026-02-10
    notes: "Revised per reviewer comments"
    doi: ""
    zenodo_url: ""
---
```


### 4.2 Tags

Multiple levels of tagging; the homepage and lists support filtering by these.

Examples: `genomics`, `spatial-omics`, `single-cell`, `diffusion-models`, `causal-inference`, `multi-modal`, `foundation-models`, `AI-Agents`.

Included in the frontmatter as: `tags: ["genomics", "causal-inference"]`.

Some tags are elevated to first-class **disciplines** (curated in `data/disciplines.yaml`) and power the homepage Discipline filter. A post can belong to more than one discipline — just include each discipline's tag (e.g. `tags: ["single-cell", "AI-Agents"]`) and it will surface under all of them.

### 4.3 Scope

Auto-generated taxonomy pages (e.g. `/scope/protocols/`, `/scope/tutorials/`).

Choices: **protocols**, **tutorials**, **negative-results**, **discussions**, **insights**, **ideas**.

### 4.4 Audience

New to field, general, technical. Powers the homepage Audience filter.

### 4.5 Lab

Lab of the writer.

### 4.6 Author

Writer of the post. Author pages at `/authors/<slug>/` (affiliation, ORCID, website, list of posts).

### 4.7 Categories

Determines which homepage pill filter a post appears under.

Supported values: **Announcement**, **Blog Post**, **Tutorial**, **Perspective**, **Paper Reviews**.

- `Announcement` — editorial and community announcements (appears under the **Announcements** pill)
- `Blog Post` — standard research write-ups (appears under the **Blogs** pill)
- `Tutorial` — step-by-step technical guides (appears under the **Tutorials** pill)
- `Perspective` — opinion pieces, field commentary (appears under the **Perspectives** pill)
- `Paper Reviews` — write-ups summarising or critiquing a published paper (appears under the **Paper Reviews** pill)

The homepage pill bar reads the `categories` taxonomy only, not `scope`. A post with `scope: ["tutorials"]` but `categories: ["Blog Post"]` will appear under the Blogs pill, not Tutorials.

**Implementation:** Hugo taxonomies (`tags`, `scope`, `audience`, `labs`, `authors`, `categories`) + list/term layouts + `data/authors.yaml` for author profiles.

### 4.8 Post formats

A post is either a **written post** (the default) or a **PDF post**: a finished paper, review or preprint published as a PDF. Both formats go through the same review, sit side by side on the homepage, and get the same DOI, likes, comments, citation tools and Google Scholar metadata.

| | Written post | PDF post |
|---|---|---|
| Frontmatter | no `format` field | `format: "pdf"` and `pdf: "paper.pdf"` |
| Body of `index.md` | the post, opening with the `summary` shortcode | the paper's abstract, nothing else |
| Page readers land on | the article | an arXiv-style abstract page: category, title, authors, dates, tags, abstract, View PDF and Download PDF buttons, then the PDF itself |
| PDF for Google Scholar and Zenodo | printed from the page on deploy | the uploaded PDF, never printed |
| Homepage card and link preview | `image`; link previews fall back to the first figure | `image`, else the first page of the PDF |

The page shows the PDF in the browser's own viewer on desktop browsers. Phones and tablets get a link that opens it full screen, because most cannot show a PDF inside a page.

A PDF post's PDF must:

- sit in the post's folder, named by `pdf:`, using letters, digits, `.`, `_` and `-` and ending in `.pdf`. `YYYY-NNN.pdf` is reserved for the PDFs the deploy prints of written posts.
- be under 5 MB, the most Google Scholar will index.
- carry the same title and authors on its first page as the frontmatter, since Scholar compares them.

`.github/scripts/validate-blog.sh` checks the first two on every PR, and warns when a PDF contains JavaScript.

To revise a published PDF post, replace the PDF under the same name and bump `revision` in `index.md`, as for any post. Zenodo only mints a new version when `index.md` changes, so a PDF swapped on its own would leave the archived copy behind.

**Template:** `docs/pdf-post-template.md` (also served at `/pdf-post-template.md`).

**Implementation:** `layouts/blogs/single.html` hands PDF posts to `partials/paper/landing.html`, which uses `paper/dates.html` and `paper/viewer.html`. Every other template finds the PDF through `partials/helper/paper-pdf.html` and its first page through `partials/helper/paper-cover.html`. `.github/scripts/optimize-images.py` renders that first page to `<pdf>.cover.png` on deploy, so local and PR builds show the plain placeholder card instead.

## 5. Peer review state machine

| State | Trigger | Tool |
|-------|---------|------|
| submitted | PR opened | GitHub |
| under-review | Editor assigned | GitHub |
| revision | Changes requested | GitHub |
| accepted | Approvals met + merge | GitHub |
| published | CI deploys | GitHub Actions |


## 6. Governance

1. Author writes a post using the predefined template.  
2. Lab-internal review.  
3. Author opens a PR.  
4. Editors review for suitability.  
5. Editors request changes if needed.  
6. Editors merge the post.


## 7. CI/CD requirements

### 7.1 On PR

- Hugo build must pass (with theme submodule).  
- Required frontmatter fields validated, plus a PDF post's PDF (§4.8).  
- Links/assets validated (optional).  
- Optional: reproducibility checks.

### 7.2 On merge

- Deploy to GitHub Pages (via `github-pages` environment).  
- Optional: create release tag.

**Implementation:** GitHub Actions (e.g. `pr-build`, `frontmatter`, `links`, `deploy`, `test-publish`).

### 8.3 Manual test-publish workflow

- `test-publish` is a manual `workflow_dispatch` workflow for exercising the `main` publish pipeline on a branch.
- It mirrors production steps closely: discussion sync/export, editor fetch, changed-post detection, optional Zenodo sync, Hugo build, and optional deployment.
- Preview output is deployed under `https://genomicsxai.github.io/previews/manual/<slug>/` so it does not overwrite the live site.
- Zenodo sync defaults to dry-run. For end-to-end testing, point `zenodo_api_base` at `https://sandbox.zenodo.org/api`.
- The editor fetch logic is shared by `deploy.yml` and `test-publish.yml` via `.github/scripts/fetch-editors.sh` so test and production stay consistent.


## 8. Forum and public discussion

### 8.1 Global forum

GitHub Discussions, categories:

- General  
- Methods  
- Post Discussions  
- Calls for Posts  

### 8.2 Per-blog discussion

- Each post has a “Discuss this post” link → GitHub Discussions (e.g. Post Discussions category).  
- Optional: embedded comments (e.g. Giscus).

**Implementation:** Hugo partial (e.g. `discuss.html`) + Discussions URL.


## 9. Citation mechanism

### 9.1 Citation box (per post)

- BibTeX download (e.g. `static/bib/<post_id>.bib` when generated).  
- RIS download (e.g. `static/bib/<post_id>.ris` when generated).  
- Copy citation button.  
- Current version DOI link when available, rendered as a full `https://doi.org/...` URL.

Rendered via Hugo partial (e.g. `citation.html`).

### 9.2 Machine-readable metadata
When the repository secret `ZENODO_API_TOKEN` is configured, the deploy workflow mints/publishes Zenodo records for accepted posts changed in the current push and stores the resulting DOI metadata in `data/zenodo.json`. Each deposit carries the post's PDF: a printout for a written post, the uploaded file for a PDF post. Frontmatter DOI fields remain valid as a manual override/fallback. BibTeX and RIS exports use standard bare DOI values, while visible citations use full DOI URLs.

- JSON-LD `BlogPosting` schema.  
- Generated via Hugo partial (e.g. `jsonld.html`).

### 9.3 DOI

- Accepted blog posts changed on `main` are archived through Zenodo by `deploy.yml`.
- `citation_pdf_url` points Google Scholar at the post's PDF: the one printed on deploy for a written post, the uploaded one for a PDF post.
- New post revisions are published as Zenodo new versions under the same concept record.
- DOI metadata is stored in `data/zenodo.json`; frontmatter `doi` and `zenodo_url` fields are fallback/manual override fields.



## 10. Navigation structure

Main menu:

- **Home** — filter posts by tags (Scientific Tags, Scope, Audience, Lab, Author); default: most recent.  
- **Forum**  
- **Editorial Board**  
- **Submission Guidelines**  
- **Policies**  

Implemented via Hugo `config.toml` menu + theme layout.


## 11. Development tracking

### 11.1 MVP checklist

- [x] PR-based submission workflow  
- [x] Tags taxonomy (tags, scope, audience, lab, author, categories)  
- [x] Reviewer + revision display (frontmatter + single layout)  
- [x] CI validation (Hugo build, frontmatter, optional link check)  
- [x] GitHub Discussions forum + per-post “Discuss” link  
- [x] Citation box (BibTeX/RIS links when files present, copy button, DOI)  
- [x] JSON-LD BlogPosting  
- [x] Author pages  
- [x] Navigation (Home, Forum, Editorial Board, Submission Guidelines, Policies)  


### 11.2 Phase 2 enhancements

- Automated DOI minting (e.g. Zenodo + release).  
- Reproducibility CI (e.g. notebook execution).  
- Versioned releases per post.  
- Metrics dashboard.  
- Open review export.  
- Generate `static/bib/<post_id>.bib` and `.ris` in CI or via Hugo.

---

The blog is transparent, version-controlled, reproducible, and community-driven.

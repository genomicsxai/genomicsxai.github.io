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
- optionally, a PDF version of the post, in the same folder (see §4.8)

The PR represents the post under review; **merge** means the post goes live.

**Implementation:** GitHub Pull Requests + PULL_REQUEST_TEMPLATE.


## 4. Blog post content model

### 4.1 Frontmatter

All blogs are submitted as markdown files with any desired images. All markdown files should contain the following frontmatter. A post can also name an optional PDF version of itself with `pdf` (see §4.8).

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

### 4.8 Optional PDF version

Every post is written in Markdown. A post can also carry a PDF of itself, typically the paper, review or preprint it reports, by placing the PDF in its folder and naming it in the frontmatter:

```yaml
pdf: "paper.pdf"
```

With a PDF version:

- The post's header shows **View PDF** and **Download PDF** buttons, and the sidebar's PDF button downloads the file instead of printing the page.
- Google Scholar's `citation_pdf_url` and the Zenodo deposit use this PDF, and the deploy no longer prints the page for that post.
- The post's JSON-LD lists the PDF as an `encoding`.

The PDF must:

- sit in the post's folder, named by `pdf:`, using letters, digits, `.`, `_` and `-` and ending in `.pdf`. `YYYY-NNN.pdf` is reserved for the PDFs the deploy prints of posts without their own.
- be under 5 MB, the most Google Scholar will index.
- carry the same title and authors on its first page as the frontmatter, since Scholar compares them.

`.github/scripts/validate-blog.sh` checks the first two on every PR, and warns when a PDF contains JavaScript. It also rejects posts made of a PDF alone (`format: "pdf"`), which the blog no longer accepts.

To revise a published post's PDF, replace the file under the same name and bump `revision` in `index.md`, as for any revision. Zenodo only mints a new version when `index.md` changes, so a PDF swapped on its own would leave the archived copy behind.

**Template:** the optional `pdf:` field in `docs/blog-post-template.md`.

**Implementation:** `partials/helper/paper-pdf.html` resolves the PDF for `layouts/blogs/single.html` (the buttons), `widget/post-actions.html`, `head/scholar-meta.html` and `jsonld.html`. `render-post-pdfs.sh` skips posts that have one, and `sync-zenodo-dois.rb` deposits it in place of a printout.

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
- Required frontmatter fields validated, plus a post's PDF version if it has one (§4.8).  
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
When the repository secret `ZENODO_API_TOKEN` is configured, the deploy workflow mints/publishes Zenodo records for accepted posts changed in the current push and stores the resulting DOI metadata in `data/zenodo.json`. Each deposit carries the post's PDF: its own PDF version if it has one, otherwise a printout of the page. Frontmatter DOI fields remain valid as a manual override/fallback. BibTeX and RIS exports use standard bare DOI values, while visible citations use full DOI URLs.

- JSON-LD `BlogPosting` schema.  
- Generated via Hugo partial (e.g. `jsonld.html`).

### 9.3 DOI

- Accepted blog posts changed on `main` are archived through Zenodo by `deploy.yml`.
- `citation_pdf_url` points Google Scholar at the post's PDF: its own PDF version if it has one, otherwise the one printed on deploy.
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

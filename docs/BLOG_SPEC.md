# Blog specification

**Architecture:** GitHub Pages + Hugo

---

## 0. Vision

A Git-native, open, reproducible scientific blog for Genomics × AI.

- **GitHub** = backend workflow + state machine  
- **Hugo** = publishing engine (static frontend)  
- **GitHub Pages** = hosting layer  

---

## 1. System architecture

### 1.1 Core stack

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Workflow backend | GitHub (repo + PR + reviews) | Submission, review, versioning |
| Policy enforcement | GitHub Actions (CI/CD) | Validation, build, deploy |
| Publishing engine | Hugo | Render blog site |
| Hosting | GitHub Pages | Public site delivery |
| Forum | GitHub Discussions | Public community discussion |

---

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

---

## 3. Submission workflow

### 3.1 Submission model

**Submission** = Pull Request that adds:

- `content/blogs/YYYY-NNN/index.md`

The PR represents the post under review; **merge** means the post goes live.

**Implementation:** GitHub Pull Requests + PULL_REQUEST_TEMPLATE.

---

## 4. Blog post content model

### 4.1 Required frontmatter schema

```yaml
---
post_id: "2026-001"
title: "Causal Interpretation of Spatial Omics"
# Taxonomy: list of author names (for /authors/<slug>/)
author: ["Author Name"]
# Display: full details for citation and JSON-LD
authors:
  - name: "Author Name"
    affiliation: "Institution"
    orcid: "0000-0000-0000-0000"
editor: "Editor Name"
tags: ["genomics", "foundation-models"]
categories: ["Blog Post"]
scope: ["insights"]
audience: ["within-field"]
labs: ["Example Lab"]
status: "accepted"
revision: 2
date_submitted: 2026-02-01
date_accepted: 2026-02-17
doi: ""
revision_history:
  - version: 1
    date: 2026-02-01
    notes: "Initial submission"
  - version: 2
    date: 2026-02-10
    notes: "Revised per reviewer comments"
---
```

**Implementation:**

- Structure: Hugo frontmatter  
- Validation: GitHub Actions (frontmatter workflow)  

---

## 5. Tags system

Multiple levels of tagging; the homepage and lists support filtering by these.

### 5.1 Scientific tags (free text)

Examples: `genomics`, `spatial-omics`, `single-cell`, `diffusion-models`, `causal-inference`, `multi-modal`, `foundation-models`.

Frontmatter: `tags: ["genomics", "causal-inference"]`.

### 5.2 Scope

Auto-generated taxonomy pages (e.g. `/scope/protocols/`, `/scope/tutorials/`).

Choices: **protocols**, **tutorials**, **negative-results**, **discussions**, **insights**, **ideas**.

### 5.3 Audience

Within-field, general, intro-to-field.

### 5.4 Lab

Lab of the writer.

### 5.5 Author

Writer of the post. Author pages at `/authors/<slug>/` (affiliation, ORCID, website, list of posts).

**Implementation:** Hugo taxonomies (`tags`, `scope`, `audience`, `labs`, `authors`, `categories`) + list/term layouts + `data/authors.yaml` for author profiles.

---

## 6. Peer review state machine

| State | Trigger | Tool |
|-------|---------|------|
| submitted | PR opened | GitHub |
| under-review | Editor assigned | GitHub |
| revision | Changes requested | GitHub |
| accepted | Approvals met + merge | GitHub |
| published | CI deploys | GitHub Actions |

---

## 7. Governance

1. Author writes a post using the predefined template.  
2. Lab-internal review.  
3. Author opens a PR.  
4. Editors review for suitability.  
5. Editors request changes if needed.  
6. Editors merge the post.

---

## 8. CI/CD requirements

### 8.1 On PR

- Hugo build must pass (with theme submodule).  
- Required frontmatter fields validated.  
- Links/assets validated (optional).  
- Optional: reproducibility checks.

### 8.2 On merge

- Deploy to GitHub Pages (via `github-pages` environment).  
- Optional: create release tag.

**Implementation:** GitHub Actions (e.g. `pr-build`, `frontmatter`, `links`, `deploy`).

---

## 9. Forum and public discussion

### 9.1 Global forum

GitHub Discussions, categories:

- General  
- Methods  
- Post Discussions  
- Calls for Posts  

### 9.2 Per-blog discussion

- Each post has a “Discuss this post” link → GitHub Discussions (e.g. Post Discussions category).  
- Optional: embedded comments (e.g. Giscus).

**Implementation:** Hugo partial (e.g. `discuss.html`) + Discussions URL.

---

## 10. Citation mechanism

### 10.1 Citation box (per post)

- BibTeX download (e.g. `static/bib/<post_id>.bib` when generated).  
- RIS download (e.g. `static/bib/<post_id>.ris` when generated).  
- Copy citation button.  
- DOI link when available.

Rendered via Hugo partial (e.g. `citation.html`).

### 10.2 Machine-readable metadata

- JSON-LD `BlogPosting` schema.  
- Generated via Hugo partial (e.g. `jsonld.html`).

### 10.3 DOI (optional, Phase 2)

- GitHub Release on acceptance; archive via Zenodo; store DOI in frontmatter.

---

## 11. Author pages

- Auto-generated at `/authors/<slug>/`.  
- Show: affiliation, website, ORCID, list of posts.  
- **Implementation:** Hugo taxonomy `authors` + `layouts/authors/term.html` + `data/authors.yaml`.

---

## 12. Navigation structure

Main menu:

- **Home** — filter posts by tags (Scientific Tags, Scope, Audience, Lab, Author); default: most recent.  
- **Forum**  
- **Editorial Board**  
- **Submission Guidelines**  
- **Policies**  

Implemented via Hugo `config.toml` menu + theme layout.

---

## 13. Repository structure

```
.github/
  PULL_REQUEST_TEMPLATE.md
  workflows/
    deploy.yml
    pr-build.yml
    frontmatter.yml
    links.yml
  CODEOWNERS

content/
  blogs/YYYY-NNN/index.md
  forum/_index.md
  editorial-board/_index.md
  submission-guidelines/_index.md
  policies/_index.md

layouts/
  blogs/single.html
  authors/term.html
  partials/
    citation.html
    jsonld.html
    discuss.html

static/
  bib/   # optional .bib / .ris per post_id

data/
  authors.yaml
  blog.yaml
```

---

## 14. MVP checklist

- [x] PR-based submission workflow  
- [x] Tags taxonomy (tags, scope, audience, lab, author, categories)  
- [x] Reviewer + revision display (frontmatter + single layout)  
- [x] CI validation (Hugo build, frontmatter, optional link check)  
- [x] GitHub Discussions forum + per-post “Discuss” link  
- [x] Citation box (BibTeX/RIS links when files present, copy button, DOI)  
- [x] JSON-LD BlogPosting  
- [x] Author pages  
- [x] Navigation (Home, Forum, Editorial Board, Submission Guidelines, Policies)  

---

## 15. Phase 2 enhancements

- Automated DOI minting (e.g. Zenodo + release).  
- Reproducibility CI (e.g. notebook execution).  
- Versioned releases per post.  
- Metrics dashboard.  
- Open review export.  
- Generate `static/bib/<post_id>.bib` and `.ris` in CI or via Hugo.

---

## 16. System summary

- **GitHub** = backend workflow + provenance.  
- **Hugo** = deterministic publishing engine.  
- **GitHub Pages** = hosting.

The blog is transparent, version-controlled, reproducible, and community-driven.

---
post_id: "YYYY-NNN"
title: "Your Post Title"

# Publishing a finished paper as a PDF instead? Start from pdf-post-template.md.

# Optional: image filename "your-image.png" in the same folder

# Optional: Enable KaTeX for inline/block math (e.g. $10^{-K}$)
math: true

# Author(s): list of names (used for /authors/<slug>/)
authors: ["Author One", "Author Two"]

# Optional: full details for citation, display and JSON-LD
authors_display:
  - name: "Author One"
    affiliation: "Institution"
    orcid: ""
  - name: "Author Two"
    affiliation: "Institution"
    orcid: ""

editor: "Editor Name"

# Set automatically by the submission form to the GitHub login of the original
# submitter. Used by the form to surface "Update one of my previous posts" for
# the same account on later revisions. Safe to omit when authoring manually.
# submitter_github: "your-github-login"

# Add any number of tags. They're searchable on the blog homepage. See https://genomicsxai.github.io/tags/ for examples.
tags: ["genomics", "causal-inference"]
# Category determines which homepage pill filter the post appears under.
# Supported values: "Announcement", "Blog Post", "Tutorial", "Perspective", "Paper Reviews"
#   - "Announcement"  → appears under the Announcements pill (editorial/community announcements)
#   - "Blog Post"     → appears under the Blogs pill (default for most posts)
#   - "Tutorial"      → appears under the Tutorials pill (step-by-step technical guides)
#   - "Perspective"   → appears under the Perspectives pill (opinion pieces, commentary)
#   - "Paper Reviews" → appears under the Paper Reviews pill (summaries/critiques of a published paper)
# Note: the homepage pills filter by `categories` only, not by `scope`.
categories: ["Blog Post"]

# One or more: protocols, tutorials, negative-results, discussions, insights, ideas
scope: ["insights"]
# One or more: technical, general, new-to-field
audience: ["technical"]
labs: ["Your Lab Name"]

status: "submitted"
revision: 1

date_submitted: 2026-02-19
date_accepted: 
date: 2026-02-19

doi: ""
zenodo_url: ""
revision_history:
  - version: 1
    date: 2026-02-19
    notes: "Initial submission"
    # Optional: version-specific DOI / Zenodo record link
    doi: ""
    zenodo_url: ""
---

{{< summary >}}

Include a high-level summary of your post here. Alternatively editors can write a summary of the post if requested.

{{< /summary >}}

---

## Introduction (or other name for your first section)

Your content here. Use standard Markdown. For images in the post folder:

![Alt text](filename.png "width=400")

## Section two

...
```

Maintainers can also populate DOI metadata automatically at deploy time via `data/zenodo.json` when `ZENODO_API_TOKEN` is configured in GitHub Actions.

See [BLOG_SPEC.md](./BLOG_SPEC.md) for full frontmatter and tag options.

## References

End every post with a numbered References section citing the primary literature
it builds on, giving each entry a DOI or publisher link where one exists:

```markdown
## References

1. Avsec, Ž. et al. Advancing regulatory variant effect prediction with AlphaGenome. *Nature*, 649, 1206–1218 (2026). https://doi.org/10.1038/s41586-025-10014-0
2. Linder, J. et al. Predicting RNA-seq coverage from DNA sequence as a unifying model of gene regulation. *Nature Genetics*, 57, 949–961 (2025). https://doi.org/10.1038/s41588-024-02053-6
```

Write the numbers as `1.`, `2.` — **not** `1\.`, `2\.`. The escaped form looks
fine in the source but renders as plain paragraphs instead of a numbered list,
which is what a parser looks for. Check the built preview shows a real list.

This is not required for acceptance, but it appears to matter for whether the
post shows up in Google Scholar. Scholar only indexes documents it classifies
as scholarly articles, and a bibliography seems to be one of the signals it
uses. We can't see Google's classifier, so treat this as an observation rather
than a rule — but across our own posts, every indexed one ends with a rendered
numbered list of five or more references, and the ones still missing had four or
fewer (or a bibliography that wasn't rendering as a list), independent of
length, date, or authorship. The DOIs themselves don't appear to be the deciding
factor: our earliest indexed post has none. See the
[submission
guidelines](https://genomicsxai.github.io/submission-guidelines/#why-references-matter-for-google-scholar).

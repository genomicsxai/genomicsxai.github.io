# Blog post template

Copy this into `content/blogs/YYYY-NNN/index.md` (replace YYYY-NNN with the next post id, e.g. 2026-002). Fill in the frontmatter and replace the body with your post.

```markdown
---
post_id: "YYYY-NNN"
title: "Your Post Title"
# Optional: image filename in the same folder
# image: "your-image.png"

# Author(s): list of names (used for /authors/<slug>/)
authors: ["Author One", "Author Two"]

# Optional: full details for citation and JSON-LD
authors_display:
  - name: "Author One"
    affiliation: "Institution"
    orcid: ""
  - name: "Author Two"
    affiliation: "Institution"
    orcid: ""

editor: "Editor Name"

tags: ["genomics", "causal-inference"]
categories: ["Blog Post"]

# One or more: protocols, tutorials, negative-results, discussions, insights, ideas
scope: ["insights"]
# One or more: within-field, general, intro-to-field
audience: ["within-field"]
labs: ["Your Lab Name"]

status: "submitted"
revision: 1

date_submitted: 2026-02-19
date_accepted: 
date: 2026-02-19

doi: ""
revision_history:
  - version: 1
    date: 2026-02-19
    notes: "Initial submission"
---

## Introduction

Your content here. Use standard Markdown. For images in the post folder:

![Alt text](filename.png "width=400")

## Section two

...
```

See [BLOG_SPEC.md](./BLOG_SPEC.md) for full frontmatter and tag options.

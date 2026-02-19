---
title: "Submission Guidelines"
date: 2026-01-01
---

## How to Submit a Blog Post

### Overview

The Genomics × AI blog uses a Git-native, PR-based submission workflow. All submissions go through peer review before the post goes live.

### Submission Process

1. **Write Your Post**
   - Use the blog post template (see below)
   - Conduct internal lab review first
   - Ensure all required frontmatter fields are complete

2. **Create a Pull Request**
   - Fork the repository
   - Add your post to `content/blogs/YYYY-NNN/index.md`
   - Create a PR with the submission template filled out

3. **Editor Review**
   - Editors will review your submission
   - They may request changes via PR comments
   - Address feedback and update your PR

4. **Going live**
   - Once approved, editors will merge your PR
   - The post will be automatically deployed via GitHub Actions
   - Your post will appear on the blog

### Required Frontmatter

All blog posts must include:

```yaml
---
post_id: "2026-001"
title: "Your Title"
# Taxonomy: list of author names (for /authors/<slug>/)
author: ["Author Name"]
authors:
  - name: "Author Name"
    affiliation: "Institution"
    orcid: "0000-0000-0000-0000"
editor: "Editor Name"
tags: ["genomics", "causal-inference"]
categories: ["Blog Post"]
scope: ["insights"]
audience: ["within-field"]
labs: ["Your Lab"]
status: "submitted"
revision: 1
date_submitted: 2026-02-01
date_accepted: 2026-02-17
doi: ""
revision_history:
  - version: 1
    date: 2026-02-01
    notes: "Initial submission"
---
```

### Content Guidelines

- **Scientific Tags**: Use relevant tags from genomics, AI, and related fields
- **Scope**: Choose from: protocols, tutorials, negative-results, discussions, insights, ideas
- **Audience**: Specify: within-field, general, or intro-to-field
- **Lab**: Your lab affiliation
- **Status**: Starts as "submitted", updated by editors during review

### Review Criteria

Editors evaluate submissions based on:

- Scientific accuracy and rigor
- Relevance to Genomics × AI community
- Clarity and accessibility
- Adherence to submission guidelines
- Originality and contribution

### Questions?

Contact the editorial team via [GitHub Discussions](https://github.com/genomicsxai/genomicsxai.github.io/discussions) or open an issue.

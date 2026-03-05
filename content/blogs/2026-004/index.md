---
post_id: "2026-004"
title: "Preview Test Post — Please Ignore"
math: false

authors: ["Alan Murphy"]

authors_display:
  - name: "Alan Murphy"
    affiliation: "Cold Spring Harbor Labs (CSHL)"
    orcid: "0000-0002-2487-8753"

editor: "Editor Name"

tags: ["test"]
categories: ["Blog Post"]

scope: ["insights"]
audience: ["general"]
labs: ["Koo lab"]

status: "submitted"
revision: 1

date_submitted: 2026-03-05
date_accepted:
date: 2026-03-05

doi: ""
revision_history:
  - version: 1
    date: 2026-03-05
    notes: "Initial submission"
---

{{< summary >}}

This is a test post to verify the PR preview deployment workflow. It should render at the preview URL posted in the PR comments and will be deleted before merging.

{{< /summary >}}

---

## What this tests

This post exists solely to verify that the PR preview workflow:

- Builds the Hugo site from the PR branch
- Deploys to the `previews/pr-{number}/` subdirectory
- Posts a comment on the PR with the preview URL
- Marks all preview pages with `noindex, nofollow` so they are not indexed

## A section with formatting

Here is some **bold text**, some _italics_, and a list:

1. First item
2. Second item
3. Third item

And a code block:

```python
def hello():
    print("Preview is working!")
```

And a blockquote:

> If you can read this in the preview, the workflow is working correctly.

## References

No references — this is a test post.

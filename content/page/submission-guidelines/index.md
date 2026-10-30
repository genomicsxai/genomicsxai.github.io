---
title: "Submission Guidelines"
date: 2026-05-01
url: "/submission-guidelines/"
---

## Submit Your Blog Post

The Genomics × AI blog uses a light, non-gate keeping peer-review, Git-native 
workflow. There are **two ways to submit a post** — both go through the same 
editorial review and produce the same final published post. Pick whichever 
fits how you like to work:

- **Option 1 — Open a pull request.** Fastest path if you're already
  comfortable with Git and Markdown: write your post locally, push a branch,
  open a PR.
- **Option 2 — Use the online submission form.** No local Git required. Sign
  in with GitHub and either upload a template `index.md` or write the post
  from scratch in the form's text fields. The form forks the repo, commits
  your files, and opens the PR for you.

You'll need a [GitHub account](https://github.com/signup) for either path.

---

### Option 1 — Open a pull request (for Git / Markdown users)

If you already work in Git, this is the quickest route:

- [Fork the repository](https://github.com/genomicsxai/genomicsxai.github.io/fork).
- Copy the
  [blog post template](https://github.com/genomicsxai/genomicsxai.github.io/blob/main/docs/blog-post-template.md)
  and fill in the YAML frontmatter.
- Add your post to `content/blogs/YYYY-NNN/index.md`; place images in the
  **same folder** (e.g. `content/blogs/YYYY-NNN/figure1.png`).
- Your PR must contain **only** files inside `content/blogs/YYYY-NNN/` — no
  changes to `static/`, `config.toml`, `.github/`, etc. If the preview bot
  posts "Preview Deployment Skipped", the comment lists the offending files.
- Open a pull request against `main`.

To revise an already-published post, just open a new PR with your changes —
editors will treat it as a revision and update `revision` /
`revision_history` on merge.

---

### Option 2 — Use the online submission form (no Git required)

If you'd rather not work in Git locally, the form below does the Git work
for you. Sign in with GitHub and you can either:

- **Upload a template `index.md`** (plus any images) — the form parses your
  frontmatter and you can edit any field before submitting, or
- **Write the post from scratch** in the form's text windows — fill in
  title, authors, tags, scope, audience, summary, and body in dedicated
  fields, with drag-and-drop image uploads and a caption per image.

When you submit, the form validates the frontmatter, forks the repo, creates
a branch, commits your files, and opens the PR on your behalf.

{{< submission-form >}}

**To revise an already-published post via the form**, sign in and choose
**Update one of my previous posts**, then pick the post from the dropdown
(only posts you originally submitted appear) and add a one-line revision
note. You can either pre-fill the form from the published version and edit,
or start blank for a full rewrite. Submitting opens a PR that bumps
`revision`, appends to `revision_history`, and re-enters editorial review.

On first use, the form asks you to authorize the **Genomics × AI Submission**
OAuth app. It requests the `public_repo` scope — enough to fork, branch,
commit, and PR on your behalf. It can't read private repositories or change
your account settings. Revoke any time from your
[Authorized OAuth Apps](https://github.com/settings/applications).

---

## What happens after you submit

Both options lead to the same review pipeline:

1. **Preview** — Within a few minutes a bot posts a comment on your PR with a
   live preview URL. It updates on each new commit. The preview may 404 for
   1–2 minutes while GitHub Pages propagates.
2. **Editor review** — Editors run a lightweight
   [Minimal Viable Review (MVR)](https://genomicsxai.github.io/editorial-review/)
   for clarity, correctness, and fit. They may request changes via PR
   comments.
3. **Going live** — Once approved, editors merge the PR and GitHub Actions
   deploys the post.

## Writing notes

- There are no strict stylistic requirements, but posts should be clear,
  accessible, and engaging for a broad scientific audience.
- Use headings, figures, and examples where helpful.
- Cite prior work via hyperlinks or formal inline citations, and **include a
  numbered References section at the end** that renders as an actual numbered
  list on the published page. Add a DOI or publisher link per entry where one
  exists. See [Why references matter for Google
  Scholar](#why-references-matter-for-google-scholar) below.
- Ensure claims are supported by appropriate sources.

## Why references matter for Google Scholar

Every accepted post is assigned a [Zenodo](https://zenodo.org/) DOI,
publishes Google Scholar metadata, and is also published as a PDF (on the
blog and in its Zenodo record), the format Scholar's inclusion guidelines are
written around. So your post is eligible to appear in Google Scholar and to be
cited like any other article. Getting listed there is one of the main reasons
to publish with us rather than on a personal blog.

Scholar does not index everything it can crawl, though. It only includes
documents its parser judges to be *scholarly articles*, and a reference list
appears to be one of the signals it uses to tell a research article apart from
an ordinary web page.

We want to be upfront that **this is something we have observed, not a
documented rule** — Google does not publish the details of how this decision is
made. As of August 2026, four of our eleven published posts are indexed. Every
indexed post ends with a rendered numbered list of five or more references;
every post that has been crawled and is still missing had four or fewer — or, in
one case, a full bibliography that was not rendering as a list at all. Length,
publication date, and authorship did not predict inclusion.

Two practical points follow from that:

- **It is the rendered list that counts, not the DOIs.** Our earliest indexed
  post carries no DOI links at all, while a post with fourteen DOI links was
  *not* indexed — its references were written as `1\.`, `2\.`, and the escaped
  period makes Markdown emit plain paragraphs instead of an `<ol>`, so there is
  no reference list for a parser to find. Write `1.`, `2.` and check that the
  published page really shows a numbered list. DOIs are still worth adding, for
  readers and for citation tracking.
- **More entries is better than fewer.** We would not read anything into the
  exact boundary, but posts with only a handful of references have not been
  picked up.

So: a References section is not a hard requirement for acceptance, and a post
without one can still be published. But if you would like your post to be
discoverable and citable in Google Scholar, cite the primary literature your
work builds on. Even if Scholar has already crawled your post, adding references
later is worthwhile — it will be reconsidered on a future crawl, though that can
take weeks to months.

## What editors look for

Editors aim to confirm, in a lightweight pass, that your post:

- **Belongs here** — genomics × AI remit; `scope`, tags, and `audience` match
  the content
- **Holds up technically** — no obvious factual errors; claims match the
  evidence you provide
- **Works for readers** — logical flow (motivation → content → takeaway),
  appropriate level for the audience
- **Is complete in the basics** — opening summary via the `summary`
  shortcode, reasonable attribution, working links, clean formatting

For the full framework, see
**[Editorial Review (MVR)](https://genomicsxai.github.io/editorial-review/)**.

## Example of a strong post

Style and length can vary, but a good reference is
[**Adapting AlphaGenome to MPRA data**](https://genomicsxai.github.io/blogs/2026-002/):
it states the problem clearly, walks through methods and results in order,
includes a reader-facing **Summary**, figures, code-oriented guidance,
references, and honest limitations. Use it as inspiration, not a rigid
template.

## Getting notified of comments and likes

Comments and likes use **GitHub Discussions**. To get notified:

1. **Watch the repository** — On the
   [repo page](https://github.com/genomicsxai/genomicsxai.github.io), click
   **Watch** → **Custom** → enable **Discussions**.
2. **Subscribe to your post's discussion** — Once your post has at least one
   comment or reaction, a discussion appears under
   [Post Discussions](https://github.com/genomicsxai/genomicsxai.github.io/discussions/categories/post-discussions).
   Open your discussion and click **Subscribe** for that thread only.

Editors and maintainers can use the same options to follow all post activity.

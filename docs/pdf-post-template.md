---
post_id: "YYYY-NNN"
# Exactly as on the PDF's first page: Google Scholar compares the two.
title: "Your Paper Title"

# A PDF post publishes a finished paper (a review, preprint or report) as a
# PDF. Readers land on a page with its title, authors and abstract, and the
# PDF below them. To write a post in Markdown instead, use
# blog-post-template.md.
format: "pdf"
# The PDF, in the same folder as this file. Under 5 MB (Google Scholar ignores
# larger PDFs), named with letters, digits, ".", "_" and "-" only, and not
# YYYY-NNN.pdf, which is reserved.
pdf: "paper.pdf"

# Optional: an image in this folder for the homepage card and link previews.
# Without one they show the first page of the PDF.
# image: "figure1.png"

# Author(s), in the order and spelling of the PDF's first page.
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

# Add any number of tags, including at least one discipline tag. See
# https://genomicsxai.github.io/tags/ for examples.
tags: ["genomics", "seq2func"]
# "Paper Reviews" fits a review of published work. The other categories are
# listed in blog-post-template.md.
categories: ["Paper Reviews"]

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
    doi: ""
    zenodo_url: ""
---

Paste the paper's abstract here, as it appears in the PDF. It is the whole body
of a PDF post: it appears above the PDF on the post's page, and in the post's
Zenodo record, the newsletter and link previews. Markdown and $math$ work.
Leave out headings, figures and the summary block that written posts open with.

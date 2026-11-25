---
post_id: "2026-013"
title: "[ENCODE GRAMMAR] Quickstart: Accessing and using the ENCODE GRAMMAR collection"

# Optional: image filename "your-image.png" in the same folder
image: "MYC_fig1.png"

# Optional: Enable KaTeX for inline/block math (e.g. $10^{-K}$)
math: true

# Author(s): list of names (used for /authors/<slug>/)
authors: ["Chang M. Yun", "Vivekanandan Ramalingam", "Vivian Hecht", "Anshul Kundaje"]

# Optional: full details for citation, display and JSON-LD
authors_display:
  - name: "Chang M. Yun"
    affiliation: "Stanford University"
    orcid: "0000-0003-3793-8265"
    contact: "chang.m.yun@stanford.edu"
  - name: "Vivekanandan Ramalingam"
    affiliation: "Stanford University"
    orcid: "0000-0002-3631-8913"
    contact: "vir@stanford.edu"
  - name: "Vivian Hecht"
    affiliation: "Stanford University"
    orcid: "0000-0003-4110-1388"
    contact: "vhecht@stanford.edu"
  - name: "Anshul Kundaje"
    affiliation: "Stanford University"
    orcid: "0000-0003-3084-2287"
    contact: "akundaje@stanford.edu"

editor: ["Genomics X AI Editors", "Al-Murphy", "abuendia"]

# Set automatically by the submission form to the GitHub login of the original
# submitter. Used by the form to surface "Update one of my previous posts" for
# the same account on later revisions. Safe to omit when authoring manually.
submitter_github: "chang-m-yun"

# Add any number of tags. They're searchable on the blog homepage. See https://genomicsxai.github.io/tags/ for examples.
tags: ["encode", "genomics", "deep-learning", "seq2func", "transcription-factor", "chromatin-accessibility", "transcription-initiation", "reporter-assay", "ChIP-seq", "DNase-seq", "ATAC-seq", "PRO-cap", "MPRA"]
# Category determines which homepage pill filter the post appears under.
# Supported values: "Announcement", "Blog Post", "Tutorial", "Perspective", "Paper Reviews"
#   - "Announcement"  → appears under the Announcements pill (editorial/community announcements)
#   - "Blog Post"     → appears under the Blogs pill (default for most posts)
#   - "Tutorial"      → appears under the Tutorials pill (step-by-step technical guides)
#   - "Perspective"   → appears under the Perspectives pill (opinion pieces, commentary)
#   - "Paper Reviews" → appears under the Paper Reviews pill (summaries/critiques of a published paper)
# Note: the homepage pills filter by `categories` only, not by `scope`.
categories: ["Blog Post", "Tutorial"]

# One or more: protocols, tutorials, negative-results, discussions, insights, ideas
scope: ["resource"]
# One or more: within-field, general, intro-to-field
audience: ["new-to-field", "general"]
labs: ["Kundaje Lab"]

status: "accepted"
revision: 2

date_submitted: 2026-08-03
date_accepted: 
date: 2026-08-04

doi: ""
zenodo_url: ""
revision_history:
  - version: 1
    date: 2026-08-03
    notes: "Initial submission"
    # Optional: version-specific DOI / Zenodo record link
    doi: ""
    zenodo_url: ""
  - version: 2
    date: 2026-11-25
    notes: "Added a PDF of the post to its Zenodo record. The post itself is unchanged."
---

{{< summary >}}
**ENCODE GRAMMAR** (Genomic Regulatory Atlas of sequence Models, Motifs, Annotations and Rules) is a collection of 3,865 experiment-specific deep learning model sets and derived sequence annotations that connect the ENCODE project's human gene regulation maps from extensive biochemical profiling experiments to the underlying DNA sequence features that drive regulatory activity. 

This five-minute **quickstart guide** shows how to find an ENCODE GRAMMAR model-set and its associated annotation and load its most commonly used outputs into an interactive genome browser. By following the steps below, you will create a browser session displaying an experimentally observed regulatory profile, the corresponding model-predicted profile, and a base-resolution sequence-contribution map.

**Contributions**: _(Author order does not represent relative contribution)_
- Vivekanandan Ramalingam<sup>1</sup> (vir@stanford.edu): BPNet model optimization and training, data uploads, general analysis
- Chang M. Yun<sup>1</sup> (chang.m.yun@stanford.edu): ChromBPNet model training, MotifCompendium analysis
- Vivian Hecht<sup>1</sup> (vhecht@stanford.edu): ChromBPNet model training, model resource uploads, project management
- Aman Patel<sup>1</sup> (patelas@stanford.edu): Model resource uploads
- Anusri Pampari<sup>1</sup> (anusri@stanford.edu): ChromBPNet model development, ChromBPNet model training, data uploads
- Ziwei Chen<sup>1</sup> (ziwei75@stanford.edu): ReporterNet model development, ReporterNet model training, ChromBPNet model training
- Kelly Cochran<sup>1</sup> (kcochran@stanford.edu): ProCapNet model development and training
- Adam He<sup>1</sup> (ayhe@stanford.edu): ProCapNet user guide
- Surag Nair<sup>1</sup> (surag@stanford.edu), Zahoor Zafrulla<sup>1</sup> (zahoor@stanford.edu), Alex Tseng<sup>1</sup> (amtseng@stanford.edu): BPNet refactoring
- Avanti Shrikumar<sup>1</sup> (avanti@stanford.edu), Jacob Schreiber<sup>1</sup> (jmschr@stanford.edu), Alex Tseng<sup>1</sup> (amtseng@stanford.edu): TF-MoDISco methods development and optimization
- Austin Wang<sup>1</sup> (atwang@stanford.edu): FiNeMo methods development
- Salil Deshpande<sup>1</sup> (salil512@stanford.edu), Chang M. Yun<sup>1</sup> (chang.m.yun@stanford.edu): MotifCompendium methods development
- Abhimanyu Banerjee<sup>1</sup> (manyu@stanford.edu), Georgi K. Marinov<sup>1</sup> (marinovg@stanford.edu): Zinc finger transcription factor analysis
- Chang M. Yun<sup>1</sup> (chang.m.yun@stanford.edu), Vivian Hecht<sup>1</sup> (vhecht@stanford.edu), Vivekanandan Ramalingam<sup>1</sup> (vir@stanford.edu): Blog posts
- Anshul Kundaje<sup>1</sup>* (akundaje@stanford.edu): Conceptualization, Project management, Mentoring, Funding, Blog post editing

_<sup>1</sup>Stanford University, *Correspondence._

{{< /summary >}}

---
> This is the second post in a series on **ENCODE GRAMMAR**. The series will cover:
> 1. [ENCODE GRAMMAR: The ENCODE deep learning model resource for decoding the DNA sequence logic of genomic regulatory elements](https://genomicsxai.github.io/blogs/2026-012/)
> 1. **Accessing and using the ENCODE GRAMMAR collection: A quickstart guide (this post)**
> 1. Interpreting regulatory DNA with deep learning models
> 1. The transcription factor binding GRAMMAR resource
> 1. The chromatin accessibility GRAMMAR resource
> 1. Predicting the effects of noncoding genetic variants
> 1. MotifCompendium - a unified lexicon of regulatory sequence motifs
> 1. Contrasting regulatory sequence codes across assays and cell types
> 1. Building a production-scale model atlas in an academic setting

## Quick-start guide (5 min)
ENCODE GRAMMAR transforms individual ENCODE experiments into experiment-specific BPNet-family model sets together with predicted regulatory profiles, sequence-contribution maps, predictive motifs, motif instances, and variant-effect predictions. Readers who are new to the resource may wish to begin with the [**ENCODE GRAMMAR overview**](https://genomicsxai.github.io/blogs/2026-012/), which explains the biological motivation, model families, interpretation workflow, and complete collection of released products.

Below, we explain how to navigate an ENCODE GRAMMAR model-set annotation page and load several commonly used model outputs into the WashU Epigenome Browser. Visualizing these tracks is a useful first step before designing larger-scale quantitative analyses.

We use the example of a **ChromBPNet model set generated from an ATAC-seq experiment in K562 cells (ENCSR893SUD)**.

### Step 1: Find the model-set annotation page

Open the ChromBPNet model-set annotation for K562 ATAC-seq: [https://www.encodeproject.org/annotations/ENCSR893SUD/](https://www.encodeproject.org/annotations/ENCSR893SUD/).

Model-set annotations associated with an experiment can also be found from the corresponding experiment summary page.

![Figure 1](Fig1.png "ENCODE Portal annotation page for the K562 ATAC-seq ChromBPNet model set ENCSR893SUD.")

A searchable list of all ENCODE annotations is available at [https://www.encodeproject.org/annotations/](https://www.encodeproject.org/annotations/).

### Step 2: Find the files of interest

Scroll to the middle of the annotation page and select the **File details** tab to browse the available files.

For an initial exploration of a ChromBPNet model set, we recommend viewing three complementary tracks:

1. the **normalized observed signal profile**, representing the experimentally measured chromatin-accessibility profile;
2. the **normalized predicted signal profile**, representing the regulatory profile predicted by ChromBPNet from DNA sequence; and
3. the **counts sequence-contribution scores**, estimating how much each DNA base contributes to the model's prediction of total accessibility.

![Figure 2](Fig2-3.png "File details tab for the K562 ATAC-seq ChromBPNet model set ENCSR893SUD.")

The following steps require the URLs of these bigWig files. Right-click the **download icon** beside a file and select **Copy link address**. The links for this example are provided here:

- **Normalized observed signal profile**: [https://www.encodeproject.org/files/ENCFF880ZUI/@@download/ENCFF880ZUI.bigWig](https://www.encodeproject.org/files/ENCFF880ZUI/@@download/ENCFF880ZUI.bigWig)
- **Normalized predicted signal profile**: [https://www.encodeproject.org/files/ENCFF296ICJ/@@download/ENCFF296ICJ.bigWig](https://www.encodeproject.org/files/ENCFF296ICJ/@@download/ENCFF296ICJ.bigWig)
- **Counts sequence contribution scores**: [https://www.encodeproject.org/files/ENCFF407GCO/@@download/ENCFF407GCO.bigWig](https://www.encodeproject.org/files/ENCFF407GCO/@@download/ENCFF407GCO.bigWig)

This quickstart focuses on these three tracks. Additional ENCODE GRAMMAR products, including predictive motif-instance annotations, can be accessed through the ENCODE Portal and the UCSC Track Hub linked below.

For descriptions of the complete collection of files and model-derived products, see the [**ENCODE GRAMMAR overview**](https://genomicsxai.github.io/blogs/2026-012/) and the [**ENCODE 4 preprint**](https://doi.org/10.64898/2026.07.06.731365).

### Step 3: Load the bigwigs into the WashU genome browser

Navigate to the [WashU Epigenome Browser](https://epigenomegateway.wustl.edu/browser2022/). On the home page, find the **Human** section and select **hg38** to open a new browser session.

![Figure 3](Fig3.png "WashU Epigenome Browser home page with the human hg38 genome assembly selected.")

In the new browser session, select the **Tracks** icon at the top of the page and then choose **Remote Tracks** from the dropdown menu.

![Figure 4](Fig4.png "Opening the Remote Tracks menu in the WashU Epigenome Browser.")

A window for adding remote tracks will appear:

![Figure 5](Fig5.png "WashU Epigenome Browser window for adding remote tracks.")

First, add the **normalized observed signal profile** and **normalized predicted signal profile**:

1. Copy and paste the first URL from Step 2.
2. Add an informative label, such as `Observed accessibility`.
3. Click **Submit**.
4. Click **Add another track** and repeat the process for the predicted profile, using a label such as `ChromBPNet predicted accessibility`.

![Figure 6](Fig6.png "Submitting a remote bigWig track to the WashU Epigenome Browser.")

![Figure 7](Fig7.png "Selecting Add another track to load an additional remote file.")

For the third bigWig—the counts sequence-contribution scores—change the track type to **Dynseq**. Select the **Track type** menu and choose **Dynseq (dynamic sequence)** from the list.

![Figure 8](Fig8.png "Selecting the Dynseq track type for a sequence-contribution bigWig.")

Dynseq displays each nucleotide as a letter whose height and direction reflect its contribution score. Positive scores indicate bases that increase the model prediction relative to the reference, whereas negative scores indicate bases that decrease it. The nucleotide letters appear only after zooming in sufficiently. Clusters of bases with large contribution scores often correspond to predictive regulatory sequence features, including transcription-factor motif instances.

Add an informative label, such as `Counts sequence-contribution map`, and submit the track.

The completed browser session should resemble the example below, with the experimentally observed profile, model-predicted profile, and sequence-contribution map aligned at the same genomic locus:

![Figure 9](Fig9.png "WashU Epigenome Browser session displaying observed and ChromBPNet-predicted accessibility profiles together with a base-resolution sequence-contribution map.")

For more information about configuring tracks, navigating loci, and sharing sessions, see the [WashU Epigenome Browser documentation](https://epigenomegateway.readthedocs.io/en/latest/usage.html).

## How else can I use the resources?
All ENCODE data, model sets, and model-derived sequence annotations are openly available through the [**ENCODE Portal**](https://www.encodeproject.org/search/?type=Annotation&annotation_type=BPNet-model&annotation_type=ChromBPNet-model&status=released). The complete ENCODE GRAMMAR resource contains 3,865 experiment-specific model sets spanning TF binding, chromatin accessibility, transcription initiation, and high-throughput reporter activity.

Additional access points include:

- **Model-sets and sequence annotations:** Browse released [BPNet model sets](https://www.encodeproject.org/search/?searchTerm=BPNet&type=Annotation&annotation_type=BPNet-model&status=released&assay_term_name=ChIP-seq), [ChromBPNet model sets](https://www.encodeproject.org/search/?searchTerm=ChromBPNet&type=Annotation&annotation_type=ChromBPNet-model&organism.scientific_name=Homo+sapiens&status=released), [ProCapNet model sets](https://www.encodeproject.org/search/?searchTerm=ProCapNet&type=Annotation), and [ReporterNet model sets](https://www.encodeproject.org/search/?searchTerm=ReporterNet&type=Annotation&status=released) on the ENCODE Portal.
- **HuggingFace model zoo:** Download ENCODE GRAMMAR models from [**Hugging Face**](https://huggingface.co/collections/kundajelab/encode-bpnet-models).
- **Predictions and sequence annotations:** Explore model predictions, sequence-contribution maps, and predictive motif instances through the [**UCSC Track Hub**](https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&hubUrl=https://kundajelab.github.io/ucsc-trackhub-encode.github.io/hub.txt).
- **Unified motif lexicon:** Access the [**ENCODE Motif Compendium**](https://www.encodeproject.org/annotations/ENCSR091GRD/), which organizes related predictive motifs discovered across all ENCODE GRAMMAR models.
- **Software:** Train and interpret new models using the open-source [BPNet](https://github.com/kundajelab/bpnet/), [ChromBPNet](https://github.com/kundajelab/chrombpnet/), and [ProCapNet](https://github.com/kundajelab/ProCapNet/) repositories.
- **User guide:** We are developing an _interactive_ guide to help users navigate and interpret the resource (_work in progress_).
- **Overview and publications:** Read the [ENCODE GRAMMAR overview](https://genomicsxai.github.io/blogs/2026-012/), [ENCODE 4 preprint](https://doi.org/10.64898/2026.07.06.731365), the [BPNet paper](https://doi.org/10.1038/s41588-021-00782-6), [ChromBPNet preprint](https://doi.org/10.1101/2024.12.25.630221) and [ProCapNet preprint](https://doi.org/10.1101/2024.05.28.596138) for additional detail.

This quickstart covers only one way to explore the resource. Future (weekly) posts in this series will describe how to interpret sequence-contribution maps, compare predictive motifs across cellular contexts, and use the models to estimate the molecular effects of noncoding genetic variants.

## References
1. The ENCODE Project Consortium et al. The Encyclopedia of DNA Elements. _bioRxiv_ 2026.07.06.731365 (2026) ([https://doi.org/10.64898/2026.07.06.731365](https://doi.org/10.64898/2026.07.06.731365))
1. Yun, C. M. et al. A unified lexicon of predictive DNA sequence motifs from ENCODE transcription factor binding and chromatin accessibility assays. (2025) doi:10.5281/zenodo.17179111. ([https://doi.org/10.5281/zenodo.17179111](https://doi.org/10.5281/zenodo.17179111))
1. Avsec, Ž. et al. Base-resolution models of transcription-factor binding reveal soft motif syntax. _Nat Genet_ 53, 354—366 (2021). ([https://doi.org/10.1038/s41588-021-00782-6](https://doi.org/10.1038/s41588-021-00782-6))
1. Pampari, A. et al. ChromBPNet: bias factorized, base-resolution deep learning models of chromatin accessibility reveal cis-regulatory sequence syntax, transcription factor footprints and regulatory variants. _bioRxiv_ 2024.12.25.630221 (2024). ([https://doi.org/10.1101/2024.12.25.630221](https://doi.org/10.1101/2024.12.25.630221))
1. Cochran, K. et al. Dissecting the cis-regulatory syntax of transcription initiation with deep learning. _bioRxiv_ 2024.05.28.596138 (2024). ([https://doi.org/10.1101/2024.05.28.596138](https://doi.org/10.1101/2024.05.28.596138))
1. Shrikumar, A., Greenside, P. & Kundaje, A. Learning Important Features Through Propagating Activation Differences. _arXIV_ (2019).([https://doi.org/10.48550/arXiv.1704.02685](https://doi.org/10.48550/arXiv.1704.02685))
1. Lundberg, S. M. & Lee, S.-I. A unified approach to interpreting model predictions. in _Proceedings of the 31st International Conference on Neural Information Processing Systems_ 4768–4777 (Curran Associates Inc., Red Hook, NY, USA, 2017). ([https://dl.acm.org/doi/10.5555/3295222.3295230](https://dl.acm.org/doi/10.5555/3295222.3295230))
1. Shrikumar, A. et al. Technical Note on Transcription Factor Motif Discovery from Importance Scores (TF-MoDISco) version 0.5.6.5. _arXiv_  (2020) ([https://doi.org/10.48550/arXiv.1811.00416](https://doi.org/10.48550/arXiv.1811.00416)).

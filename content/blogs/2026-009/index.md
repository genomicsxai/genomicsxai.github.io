---
post_id: "2026-009"
title: "Beyond coverage tracks: fine-tuning AlphaGenome's splicing heads from scratch"
image: "alphagenome_rna_heads.png"
math: false

authors: ["Miquel Anglada-Girotto", "Jonathan Frazer", "Mafalda Dias"]

authors_display:
  - name: "Miquel Anglada-Girotto"
    affiliation: "Center for Genomic Regulation (CRG)"
    orcid: "0000-0003-1885-8649"
  - name: "Jonathan Frazer"
    affiliation: "Center for Genomic Regulation (CRG)"
    orcid: "0000-0001-6900-6484"
  - name: "Mafalda Dias"
    affiliation: "Center for Genomic Regulation (CRG)"
    orcid: "0000-0002-1804-8542"

editor: "Genomics X AI Editors"

tags: ["genomics", "AlphaGenome", "PyTorch", "development", "GPUs", "seq2func", "RNA-seq", "splicing", "fine-tuning", "debugging"]
categories: ["Blog Post"]

scope: ["insights"]
audience: ["within-field"]
labs: ["Dias and Frazer lab"]

status: "submitted"
revision: 1

date_submitted: 2026-05-24
date_accepted: 
date: 2026-05-24

doi: ""
zenodo_url: ""
revision_history:
  - version: 1
    date: 2026-05-24
    notes: "Initial submission"
    # Optional: version-specific DOI / Zenodo record link
    doi: ""
    zenodo_url: ""
---

{{< summary >}}
DeepMind has released [AlphaGenome](https://deepmind.google/discover/blog/alphagenome-a-foundation-model-for-genome-biology/)’s code and model weights, and the community has since developed [alphagenome_ft](https://github.com/genomicsxai/alphagenome_ft) and [alphagenome-pytorch](https://github.com/genomicsxai/alphagenome-pytorch) to enable seamless fine-tuning in both JAX and PyTorch. These implementations support bigwig-based modalities such as RNA sequencing (RNA-seq) coverage tracks, but other RNA-seq-derived outputs, including splice site probabilities, splice site usage, and splice junctions, require additional work, from data preprocessing and loading to validating fine-tuning on unseen samples. What initially seemed like a straightforward extension became a useful exercise in understanding how large genomic models learn and how to debug new output heads.

In this post, we share that development process: preprocessing the data, building loaders, running sanity checks, and overfitting a single interval, including the bugs we found along the way and how we fixed them. We then scale up to full fine-tuning and evaluation on held-out genomic intervals and report the resulting performance for two fine-tuning strategies.

All code, model adaptations, and pipelines used for this blog post are [available](https://github.com/MiqG/alphagenome_finetuning_rna/tree/v1.0.1).

{{< /summary >}}

---

## Motivation

This post is an implementation report: we walk through preprocessing, data loading, debugging, and held-out evaluation for AlphaGenome's splicing heads. We do not yet interpret these results biologically — relating the model's predictions back to the SF3B1 K700E mutation itself is the subject of a follow-up post.

The goal we are working towards is a fine-tuning workflow that can take a new RNA-seq dataset and produce a model that predicts sample-specific splicing outcomes directly from sequence. Concretely, for the SF3B1 K700E case study used throughout this post: a model that, given a genomic sequence and a target sample, predicts splice site usage and junction counts well enough to flag where and how splicing differs between a mutant and wild-type sample, without needing RNA-seq data for that sample. Getting there means the model has to generalize to unseen genomic intervals, and ideally to unseen samples. This post covers the first part of that path — getting the implementation right and measuring held-out performance for two fine-tuning strategies — while the biological question of what these predictions say about SF3B1-driven cryptic splicing is left for later.

![Figure 1. Overview of AlphaGenome's splicing heads.](alphagenome_rna_heads.png "width=500 Overview of AlphaGenome's splicing heads.")

### What comes from where

Since much of this work sits between "using AlphaGenome as published," "reproducing details the paper doesn't fully specify," and "our own implementation choices," here's a breakdown of which parts of the pipeline fall into each category:

| Component | Category |
|---|---|
| Junction-head architecture and candidate splice-site conditioning | Inherited from AlphaGenome, unmodified |
| STAR/deepTools-based alignment and coverage processing | Reproduced from the AlphaGenome paper's methods, best-effort (original preprocessing code is not public) |
| Splice site usage / junction count extraction scripts, on-the-fly per-modality normalization | New implementation choices, specific to this project |
| `rope_params` truncated-normal initialization, ratio-normalized junction loss | Debugging fixes for a mismatch between the paper's pseudocode and the JAX/PyTorch implementations — not new methodological contributions |

## From raw data to preprocessed training tracks

For this fine-tuning example, we chose two RNA-seq samples from [López-Oreja (2023)](https://pubmed.ncbi.nlm.nih.gov/37562845/): one carrying the SF3B1 K700E cancer driver mutation and one without it. This mutation is known to promote the recognition of cryptic splice sites, so we expected it to affect the RNA-seq modalities considered here. In this blogpost we only use these data for code development purposes of multimodal learning, but we will delve into the sequence determinants of this misregulated modulation in the next blogpost on this topic.

AlphaGenome's data preprocessing code is not publicly available, though the key steps are described in the paper's methods. To reproduce the pipeline as closely as possible, we wrote [standardized Snakemake workflows](https://github.com/MiqG/alphagenome_finetuning_rna/blob/v1.0.1/workflows/01-obtain_data/rules/sf3b1mut.smk) that derive all four training tracks from a single STAR RNA-seq alignment BAM file. Reads are aligned with STAR following the AlphaGenome paper's alignment settings, retaining only uniquely mapped reads on canonical chromosomes.

- **Per-base RNA-seq coverage** (stranded or unstranded) is computed using `deepTools`' [`bamCoverage`](https://deeptools.readthedocs.io/en/develop/content/tools/bamCoverage.html). Output: bigwig files.
- **Splice site classes** are derived on the fly during data loading from the union of splice sites present in the splice site usage files, so no separate file is needed.
- **Splice site usage** is computed from the BAM using our custom script [`compute_ssu.py`](https://github.com/MiqG/alphagenome-pytorch/blob/splice-finetuning/scripts/compute_ssu.py), equivalent to [`SpliSER`](https://github.com/CraigIDent/SpliSER/tree/speedups). For each splice site supported by at least one junction, usage is estimated as the fraction of reads supporting that site relative to reads that skip it. Output: zstd-compressed parquet files.
- **Splice junction counts** are available directly from STAR at alignment time, or can be extracted post-hoc from the BAM using our custom script [`get_star_junctions.py`](https://github.com/MiqG/alphagenome-pytorch/blob/splice-finetuning/scripts/get_star_junctions.py). Output: tab-separated files.

![Figure 2. Data preprocessing workflow.](data_prep_workflow.png "width=500 Data preprocessing workflow.")

To make sure our custom implementations to compute splice junction counts and splice site usage matched how STAR and SpliSER calculate them respectively, we ran a comparison on chromosome 1 on our samples.

In both cases we observe a Pearson correlation of 1 (for splice junction counts from uniquely mapped reads and for splice site usage), confirming the implementations are correct.

Both implementations were also highly efficient in runtime, with [`get_star_junctions.py`](https://github.com/MiqG/alphagenome-pytorch/blob/splice-finetuning/scripts/get_star_junctions.py) requiring ~10s and ~150 MB per sample, and [`compute_ssu.py`](https://github.com/MiqG/alphagenome-pytorch/blob/splice-finetuning/scripts/compute_ssu.py) requiring ~20s and ~200 MB per sample compared to SpliSER's ~600s and ~100 MB.

![Figure 3. Benchmark of splice junction counting and splice site usage computation.](benchmark_juncs_and_ssu.png "width=350 Benchmark of splice junction counting and splice site usage computation.")

## Data loading and on-the-fly normalization

All four tracks are loaded jointly for each genomic interval and normalized on the fly before being passed to the model. Getting this right matters: RNA-seq coverage spans several orders of magnitude across genes and samples, splice junction counts are extremely sparse, and splice site labels are binary signals at a handful of positions in a million-base-pair window. Each modality needs a different normalization strategy to avoid one dominating the loss or presenting the model with uninformative targets.

**RNA-seq coverage** bigwigs are read at 1 bp resolution and binned by summation to the model's output resolution. The raw values are loaded as-is; normalization happens at training time. Just before the loss is computed, targets are scaled into model prediction space by dividing by a per-track non-zero mean (computed once from the training set), applying a power transform (x^0.75) to compress dynamic range, and smooth-clipping extreme values. Model predictions are converted back to data space using the inverse of these operations for evaluation.

**Splice site classes** are derived on the fly as a 5-class label array: donor on the positive strand, acceptor on the positive strand, donor on the negative strand, acceptor on the negative strand, and background. All positions default to background, and annotated splice sites from the union of sites in the splice site usage files are then overlaid.

**Splice site usage** values are loaded from the precomputed parquet files. For each genomic interval, only the splice sites overlapping that interval are retrieved, and usage values are arranged into a per-position array with two channels per sample (one per strand).

**Splice junction counts** from STAR are CPM-normalized using the total mapped reads per sample, clipped at the 99.99th percentile, and then mean-scaled so that the typical non-zero value is close to 1. Junctions are assembled into a donor × acceptor count matrix, with forward and reverse strand channels interleaved across samples.

![Figure 4. Normalizing training data on the fly.](data_loading_normalization.png "width=600 Normalizing training data on the fly.")

## First time never works

As a first sanity check, we verified that the model could overfit a single genomic interval using linear probing (freezing the backbone and training only the new heads). A model with enough capacity should memorize a single batch; failure to do so points to a bug rather than a generalization problem. To make the test representative, we selected an interval with median splice junction density among all training intervals (see [this](https://github.com/MiqG/alphagenome_finetuning_rna/blob/v1.0.1/figures/overfitting_interval_selection.ipynb) notebook for the selection details).

The test was useful precisely because it failed. The splice site probability heads did not overfit, and the splice junction heads did not learn at all. The next two sections trace what was wrong with each and how we fixed it.

![Figure 5. First attempt to overfit a single interval.](first_attempt.png "width=900 First attempt to overfit a single interval.")

## Initializing splice site heads with pretrained weights facilitates single-batch overfitting

The splice site classification head struggled to overfit when initialized randomly. This is not surprising: the purpose of fine-tuning AlphaGenome is not to re-learn the general splicing code from scratch. The splice site classification head captures a property shared across all samples, where donor and acceptor sites sit on each strand, while the splice site usage and junction heads carry the sample-specific signal. It therefore makes sense to start from the pretrained weights for this head and let the sample-specific heads adapt.

We explored three factors that could affect overfitting on the single interval: (1) initializing the splice site classification head from pretrained rather than random weights (see [this](https://github.com/MiqG/alphagenome_finetuning_rna/blob/v1.0.1/figures/track_indices.ipynb) notebook for how we select which pretrained tracks to use for initialization), (2) augmenting the interval's splice sites with all annotated sites from the GTF (to reduce label sparsity, since AlphaGenome was pretrained on many more samples and thus more splice sites), and (3) segmenting the loss computation to match the 8-segment sequence parallelism used during AlphaGenome pretraining. We implemented support for all three options via `finetune.py` flags: `--pretrained-head-samples` to initialize specific head weights from a pretrained track (e.g. `splice_site:0`), `--gtf` to supply a GTF or parquet file of canonical splice sites, and `--num-segments` to control how many segments the sequence is split into for loss computation (applies to all modalities, not just splicing).

Initializing from pretrained weights enabled clean overfitting regardless of whether GTF sites or loss segmentation were used. When starting from random weights, loss segmentation had a secondary effect: higher overall loss but faster overfitting, with or without the GTF augmentation.

![Figure 6. Debugging the splice site head.](debug_splice_head.png "width=600 Debugging the splice site head.")

## Why the junction head could not learn

In our first attempt, the splice junction head would not learn. Understanding why required looking at how the head works. For each genomic interval, the trunk produces 1 bp resolution embeddings across the full sequence. The junction head extracts embeddings only at the positions of known splice sites (up to 512; padded with -1 if fewer are present). Each extracted embedding is then linearly transformed with a learned per-sample scale and offset before RoPE positional encoding is applied. Junction counts for each donor-acceptor pair are then predicted as the softplus of the inner product between the corresponding donor and acceptor embeddings.

Inspecting the pretrained weights revealed the problem: the scale and offset parameters were initialized to zeros. With scale=0 and offset=0, the transformation `scale * x + offset` collapses every embedding to zero before RoPE, blocking any gradient from flowing back through those parameters. The pretrained weights for these parameters follow a truncated normal distribution, not zeros, so a randomly initialized head would be stuck from the very first step.

Cross-referencing with the original JAX implementation and reaching out to the authors (see [GitHub issue](https://github.com/google-deepmind/alphagenome_research/issues/22)) confirmed this was a bug also in the original implementation. The fix was to initialize `rope_params` with a truncated normal distribution (std=0.1), controlled via the `--rope-init` flag in [`finetune.py`](https://github.com/MiqG/alphagenome-pytorch/blob/splice-finetuning/scripts/finetune.py) (default: `truncated_normal`; `zeros` is kept only for ablation experiments).

With the fix in place, the randomly initialized junction head overfits successfully when splice site positions are taken from the target junctions, set via `--junction-position-source annotated` (the default). 

![Figure 7. Debugging the splice junction head: random initialization.](splice_junctions_debug-init.png "width=800 Debugging the splice junction head: random initialization.")

Using predicted positions (`--junction-position-source predicted`) exposed a further issue: pretrained-weight initialization collapsed while random initialization still learned. The pretrained head was optimized alongside a dense, tissue-diverse set of splice site positions from pretraining; positions predicted by a freshly fine-tuned splice site head on just two samples are sparser and differently distributed, likely placing it outside its operating range. Looking at the loss values pointed to a related problem: the junction cross-entropy was going negative during training, which would destabilize any head but hit the pretrained one harder.

The root cause seemed to be a mismatch between the paper's pseudocode and both the JAX and PyTorch implementations. The supplementary methods define `multinomial_cross_entropy` by normalizing both targets and predictions to ratios before computing the cross-entropy, so `log(p_pred) <= 0` always and the loss is guaranteed non-negative. The JAX implementation instead uses a log-normalizer formulation (`log_normalizer - log_likelihood`), which is mathematically equivalent when junction counts are present but produces a negative contribution when a training window contains annotated splice sites with zero observed counts; common in sparse datasets like SF3B1 RNA-seq, where not every annotated site will have reads in a given sample. The PyTorch port (`--junction-loss original`, the default) inherited this behavior unchanged.

We opened another [GitHub issue](https://github.com/google-deepmind/alphagenome_research/issues/24) with the authors, who confirmed the discrepancy and introduced a ratio-normalized formulation: both targets and predictions are divided by their within-mask sums before computing `-p_true * log(p_pred)`. We ported this as `--junction-loss normalized`. Since `p_pred <= 1`, its log is always non-positive and the loss is always non-negative. With this correction, training is stable, the loss no longer dips below zero on our  window, and both random and pretrained-weight initialization can overfit the single interval regardless of whether annotated or predicted splice site positions are used.

![Figure 8. Debugging the splice junction head: loss formulation.](splice_junctions_debug-loss.png "width=400 Debugging the splice junction head: loss formulation.")

## What actually worked: practical recipe for full fine-tuning AlphaGenome on new samples across RNA-seq modalities

With the failure points above identified and fixed, we ran a first full fine-tuning pass across the whole genome, using linear probing (frozen trunk, only the new heads trained) with the settings that worked best during single-interval debugging:

- pretrained initialization for the splice site head,
- 8-way loss segmentation (matching AlphaGenome's pretraining sequence parallelism),
- annotated junction positions, given their robustness over predicted positions,
- truncated-normal initialization for the junction head's RoPE parameters,
- the normalized (ratio-based) junction loss,
- a constant learning rate (LR = 1e-4).

Held-out performance improved over training, alongside a modest but consistent generalization gap: at every epoch, we compared test-set performance against a same-sized random subsample of training intervals (`train_sample`). At epoch 10, held-out test performance trailed the training subsample by roughly 0.06–0.10 Pearson r across all three modalities (gene expression, splice site usage, splice junctions), for both linear-probe and LoRA. Reassuringly, that gap stayed roughly constant across epochs rather than widening — i.e. the models aren't progressively overfitting the training intervals with more training, though they also aren't closing the gap to training performance either.

![Figure 9. Held-out (solid) vs. training-subsample (dashed) performance across full fine-tuning epochs, linear-probe vs. LoRA, for gene expression, splice site usage, and splice junctions.](full_runs.png "width=700 Held-out (solid) vs. training-subsample (dashed) performance across full fine-tuning epochs, linear-probe vs. LoRA, for gene expression, splice site usage, and splice junctions.")

Gene expression performance saturated early, so we asked whether LoRA fine-tuning - updating the trunk's internal DNA representation via low-rank adapters, rather than only the new output heads — could do better, particularly on the splicing-specific modalities. Comparing linear-probing against LoRA at epoch 10 on the held-out test set:

| Metric | Linear-probe | LoRA | Δ (LoRA − probe) |
|---|---|---|---|
| Gene expression (Pearson r) | **0.899** | 0.893 | −0.006 |
| Splice site usage (Pearson r) | 0.646 | **0.659** | +0.013 |
| Splice junctions (Pearson r) | 0.788 | **0.811** | +0.023 |

As expected, LoRA, by updating the trunk's internal DNA representation instead of leaving it frozen, improved performance over linear probing on the splicing-specific metrics (splice site usage, splice junctions), while gene expression stayed essentially unchanged between the two (linear-probe even edges it out slightly there).

The two strategies also differ substantially in compute footprint. Full genome fine-tuning with LoRA needed a full NVIDIA H100 (80 GB) and took about a week, since backpropagating through the frozen trunk to reach the low-rank adapters still requires storing its activations end to end, even though the trunk's own weights aren't updated. Linear probing, by contrast, only needs gradients for the new heads, so it ran comfortably on NVIDIA Hopper-class GPUs with as little as 64 GB of memory.

The workflows for full fine-tuning and evaluation are available in the repository: [`workflows/05-full_finetuning`](https://github.com/MiqG/alphagenome_finetuning_rna/tree/v1.0.1/workflows/05-full_finetuning) and [`workflows/06-evaluation`](https://github.com/MiqG/alphagenome_finetuning_rna/tree/v1.0.1/workflows/06-evaluation).

<!-- TODO: update these two links (and the v1.0.1 tags elsewhere in this post) once blog-dev is tagged with the release that includes workflows 05/06 -->

## Limitations

The initial debugging (up to and including the loss-formulation fix) was performed on a single genomic interval with just two RNA-seq samples, so those specific observations may not generalize to larger or more diverse training sets — this is why we followed up with the full genome-wide fine-tuning run above. The preprocessing pipeline reproduces the main steps described in the AlphaGenome paper, but since the original code is not public, we cannot guarantee exact parity.

The splicing fine-tuning code currently lives in a dedicated fork of [alphagenome-pytorch](https://github.com/MiqG/alphagenome-pytorch/tree/splice-finetuning) and is pending merge into the main branch. Support in the JAX-based [alphagenome_ft](https://github.com/genomicsxai/alphagenome_ft) will follow once that merge is complete.

This post focuses on getting the implementation correct and measuring held-out performance, not on biological interpretation. We do not yet relate these predictions to independent data or ask whether the fine-tuned heads capture SF3B1-specific splicing changes — that comparison, and the accompanying biological interpretation, is left for the follow-up post. We also only evaluate two RNA-seq samples (one WT, one K700E) and a single AlphaGenome fold; generalization to more samples, mutations, or cell types remains to be tested.

## Conclusion

This process gave us a much better understanding of what it actually takes to fine-tune new transcriptomic heads on AlphaGenome. Extending the model to splicing modalities was not simply a matter of adding data loaders and output layers (as we hoped): higher label sparsity, head initialization, loss formulation, and the interaction between position sources and weight initialization all turned out to matter.

The most useful strategy was to build confidence at each step before scaling up, from preprocessing validation and target inspection to single-interval overfitting. Each stage exposed a different class of problem. The single-interval test in particular was worth its weight as the two loss bugs and a zero-initialization bug in the junction head would have been much harder to diagnose in a full training run. We hope that sharing these intermediate failures, alongside the fixes and the flags that control them, makes it easier for others to extend AlphaGenome to new RNA-seq modalities and biological questions. 

The full fine-tuning results also suggest that gene expression and splicing tasks don't need the same amount of compute: gene expression performance saturated early and didn't benefit from LoRA, so linear probing on modest hardware is likely enough there, whereas the splicing modalities kept improving and gained the most from LoRA's larger compute and memory footprint. If gene expression is your main target, linear probing is probably all you need; splicing tasks are where the extra compute marginally pays off.

In the end, this project became more than a simple port. It resulted in reusable preprocessing scripts, training pipelines, and a set of practical checks and warnings that we hope make fine-tuning RNA-seq–derived splicing modalities on AlphaGenome more transparent and reproducible. We are especially grateful to the DeepMind developers for openly sharing their code and model weights, and for the responsiveness of Tom Ward ([`@tomwardio`](https://github.com/tomwardio)) and Vincent Dutordoir ([`@vdutor`](https://github.com/vdutor)) when we reported bugs and implementation issues; their feedback was instrumental in reaching the conclusions presented here. We hope these efforts help make fine-tuning splicing heads as seamless and accessible as possible for the broader community.

## Reproducibility

The repository [alphagenome_finetuning_rna](https://github.com/MiqG/alphagenome_finetuning_rna/tree/v1.0.1) contains all the necessary code, from data downloading to analysis and figures, to reproduce these results.

## References

1. Avsec, Ž. et al. Advancing regulatory variant effect prediction with AlphaGenome., 649, Nature (2026). https://doi.org/10.1038/s41586-025-10014-0
2. López-Oreja, I. et al. SF3B1 mutation-mediated sensitization to H3B-8800 splicing inhibitor in chronic lymphocytic leukemia., 6, Life Sciences Alliance (2023). https://doi.org/10.26508/lsa.202301955
3. Dent, C.I. et al. Quantifying splice-site usage: a simple yet powerful approach to analyze splicing., 3, NAR Genomics and Bioinformatics (2021). https://doi.org/10.1093/nargab/lqab041
4. Ramírez, F. et al. deepTools2: a next generation web server for deep-sequencing data analysis., 44, Nucleic Acids Research (2016). https://doi.org/10.1093/nar/gkw257
5. Dobin, A. et al. STAR: ultrafast universal RNA-seq aligner., 29, Bioinformatics (2013). https://doi.org/10.1093/bioinformatics/bts635

## Acknowledgements

Thanks to the [Genomics x AI](https://genomicsxai.github.io/) community and the Kundaje Lab at Stanford, where the AlphaGenome PyTorch port is being developed as well. We acknowledge the EuroHPC Joint Undertaking for awarding this project access to the EuroHPC supercomputer MareNostrum 5, hosted by the Barcelona Supercomputing Center (Spain) through an EuroHPC Development Access call. We acknowledge support of the Spanish Ministry of Science and Innovation through the Centro de Excelencia Severo Ochoa (CEX2020-001049-S, MCIN/AEI /10.13039/501100011033), and the Generalitat de Catalunya through the CERCA programme, and to the EMBL partnership. We are grateful to the CRG Core Technologies Programme for their support and assistance in this work.

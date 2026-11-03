---
post_id: "2026-015"
title: "ChromBPNet-refactor: An optimized, reproducible implementation in PyTorch/TensorFlow/JAX with bug fixes"

# Optional: image filename "your-image.png" in the same folder
image: "chrombpnet_refactor.png"

# Optional: Enable KaTeX for inline/block math (e.g. $10^{-K}$)
math: true

# Author(s): list of names (used for /authors/<slug>/)
authors: ["Chang M. Yun", "Vivian Hecht", "Anshul Kundaje"]

# Optional: full details for citation, display and JSON-LD
authors_display:
  - name: "Chang M. Yun"
    affiliation: "Stanford University"
    orcid: "0000-0003-3793-8265"
    contact: "chang.m.yun@stanford.edu"
  - name: "Vivian Hecht"
    affiliation: "Stanford University"
    orcid: "0000-0003-4110-1388"
    contact: "vhecht@stanford.edu"
  - name: "Anshul Kundaje"
    affiliation: "Stanford University"
    orcid: "0000-0003-3084-2287"
    contact: "akundaje@stanford.edu"

editor: ["Genomics X AI Editors",]

# Set automatically by the submission form to the GitHub login of the original
# submitter. Used by the form to surface "Update one of my previous posts" for
# the same account on later revisions. Safe to omit when authoring manually.
submitter_github: "chang-m-yun"

# Add any number of tags. They're searchable on the blog homepage. See https://genomicsxai.github.io/tags/ for examples.
tags: ["encode", "genomics", "deep-learning", "seq2func", "chromatin-accessibility", "DNase-seq", "ATAC-seq"]
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
scope: ["resource"]
# One or more: within-field, general, intro-to-field
audience: ["general"]
labs: ["Kundaje Lab"]

status: "accepted"
revision: 1

date_submitted: 2026-10-20
date_accepted: 
date: 2026-10-20

doi: ""
zenodo_url: ""
revision_history: ""
---

{{< summary >}}
__ChromBPNet__ is a deep learning DNA sequence model that models chromatin accessibility, at base-resolution with DNase I/Tn5 transposase enzyme bias-factorization. Despite wide use of the model, there have been several improvements that we had been considering. Here, we apply those updates and present a [__refactored codebase of ChromBPNet__](https://github.com/kundajelab/chrombpnet-refactor/), that systematically improves the following: (1) support for all 3 major deep learning frameworks, PyTorch, TensorFlow and JAX, on current releases and GPUs; (2) a corrected, selectable cut-site convention for DNase-seq; (3) the optimizations from Anthropic’s Claude Fable/Mythos 5.1 [model release](https://www.anthropic.com/claude-fable-and-mythos-5-1) that apply to ChromBPNet’s pipeline; and (4) additional optimizations in pre- and post-processing—all with confirmed reproducibility to the original model. We share this study to highlight the benefits of early open access code to the community to help build better software and understanding together.
{{< /summary >}}

---
## ChromBPNet: A bias factorized, base-resolution deep learning model of chromatin accessibility

ChromBPNet is a deep learning model of __chromatin accessibility__: how accessible a region of chromatin is—chromatin being the native DNA molecule in eukaryotic cells, that is in complex with other nuclear proteins and RNA to be packaged into a dense, compact structure—that in turn, determines how much the DNA is accessible to other cellular processes, including transcription. Experiments measure the level of accessibility of different regions of the genome in different cell types: “DNase-seq” uses the enzyme DNase I to cut exposed DNA; “ATAC-seq” uses the Tn5 transposase enzyme to insert sequencing adapters into accessible DNA. Depending on how accessible the region is, the enzymes DNase I/Tn5 transposase have more/less access to the DNA to perform their activities. By sequencing and mapping the resulting DNA fragments and their suggested enzyme activity sites, chromatin regions that contain many mapped fragments are quantified as highly accessible (as “peaks”) while regions with low fragments are quantified as inaccessible (as “non-peaks”).

However, the enzymes DNase I and Tn5 transposase also have preferences for particular DNA sequences, so the observed signal profiles reflect both genuine chromatin accessibility and assay-specific sequence bias. Separating these components is especially important when interpreting the signal at single-base resolution.

Here, ChromBPNet was developed to learn to predict chromatin accessibility signal from DNA sequence, at base-resolution with the explicit factorization of the enzyme’s sequence bias. ChromBPNet, together with robust model interpretation methods, has previously been shown to predict accessibility in unseen chromosomes, identify the binding preference and binding sites of known, cell type-specific transcription factors (TFs) that influence accessibility, and predict the effects of genomic variation on accessibility (caQTLs) across cell type and population—which we expanded to train 1,512 ChromBPNet models as part of [ENCODE GRAMMAR](https://genomicsxai.github.io/blogs/2026-012/).

However, while highly effective, like any model, ChromBPNet had room for improvements.

## 1. Support all 3 major deep learning libraries, on modern hardware: PyTorch, TensorFlow, JAX

__Problem__: Deep learning advances rapidly. While development of the original ChromBPNet began in 2021, and hence developed on the latest deep learning packages and hardware at the time—TensorFlow 2.8 on Python 3.8—the deep learning stack has rapidly accelerated since, making ChromBPNet incompatible with modern versions.

__Solution__: Here, we reimplemented ChromBPNet across all 3 major deep learning libraries: PyTorch 2.14.1 (default), TensorFlow 2.21.0 (with tf-keras 2.21.0, the Keras 2 API), and JAX 0.11.2 (with Keras 3.15.1), all behind one shared, framework-neutral pipeline.

__How to use__: Each engine has its own conda environment, because their frameworks cannot share one. Create the ones you need from the repository root:

| Engine | Create the environment | Then | Python and framework |
|---|---|---|---|
| PyTorch (default) | `conda env create -f envs/chrombpnet-pytorch.yml` | `conda activate chrombpnet-pytorch` | Python 3.12, PyTorch 2.14.1 |
| TensorFlow | `conda env create -f envs/chrombpnet-tensorflow.yml` | `conda activate chrombpnet-tensorflow` | Python 3.12, TensorFlow 2.21.0 (tf-keras 2.21.0) |
| JAX | `conda env create -f envs/chrombpnet-jax.yml` | `conda activate chrombpnet-jax` | Python 3.12, JAX 0.11.2 (Keras 3.15.1) |

Pick the engine with `--engine` (the checkpoint suffix decides when it is omitted) and the device with `--device cpu`, `cuda` or e.g. `cuda:1`. [`envs/README.md`](https://github.com/kundajelab/chrombpnet-refactor/blob/main/envs/README.md) describes each engine, its GPU libraries, and what differs between them.

## 2. Adaptable cut-site convention for DNase-seq

> Note: We are grateful to our colleagues at [Relation Therapeutics](https://www.relationrx.com/) for identifying this issue to us.

__Problem__: When constructing the experimental “ground truth” signal from the raw sequencing data, we map and count up the exact location that the enzyme was applied on the genome. For ATAC-seq, this is straightforward: Tn5 transposase acts as a homodimer to introduce a “tagmentation”—a single-stranded DNA break, followed by an immediate 5’-to-3’ ligation that attaches adapter sequences to the break (for later sequencing)—at two nearby sites that are 9 bp apart, one on each strand. Hence, to identify the exact position that the Tn5 transposase was applied, by convention, we take the middle of the two cut sites that are 9 bp apart as its position—which conveniently, coincides on top of a base (since the 9 bp gap is odd). When both ends of a region of chromatin is “tagmented”, the region is no longer attached to the original long chromatin and free as a DNA fragment, which can then be sequenced by next generation sequencing (NGS). Hence, to identify the position of the Tn5 transposase from only one DNA fragment, we trace back the other cut site that must have occurred 9 bp away, and identify its middle position, which is equivalent to positions +4 bp or -4 bp (depending on the strand direction) from the 5’ end of the sequenced fragment (only a read’s 5’ end marks a cut; its 3’ end is merely where sequencing stopped. With paired-end data, the 5’ ends of the two mates are the fragment’s two ends, so both cuts are counted). This results in one distinct base pair position per enzyme effect site.

![Figure: Processing ATAC-seq sequencing counts.](atac.png "width=600 Schematic of ATAC-seq using Tn5 transposase to measure chromatin accessibility, and its cut site convention at +4 bp / -4 bp.")

However, for DNase-seq, identifying the exact position of the enzyme activity is trickier: DNase I cleaves at just one site and the “middle” position is not on top of a specific base pair position, but _between_ two base pairs, i.e., on a specific _bond position_. For DNase-seq, DNase I only introduces one cut: a single double-stranded break between two base pairs. Hence, the “position” of the DNase I would ideally also be at the middle of the two base pairs, or on the cleaved bond itself. However, since we in genomics use one-hot-style sequence encoding, we must place the DNase I on some base pair position. By convention, we can either place the DNase I on the right-hand side of the break (which would imply the positions 0 bp or +1 bp from the sequenced 5’ end, depending on the strand), or on the left-hand side of the break (which would imply positions -1 bp or 0 bp from the sequenced 5’ end, depending on the strand), or on both sides of the break (which would imply positions 0 and -1, or 0 and +1, depending on the strand). In the original ChromBPNet, we had selected the right-hand side convention: 0 bp on the positive strand, +1 bp on the negative strand. This ensured that irrespective of which direction of the break was sequenced, we stacked counts on the same base pair position.

However, the issue arises during reverse complement augmentation of the data. In DNA sequence models, we are often (un)fortunate to double our data for free/need to take into account the opposite strand’s sequence, by taking the reverse complement of the original data. ChromBPNet also followed this training protocol: for a random half of the training examples, it takes the reverse complement of the input sequence and reverses the signal profile. However, when taking the reverse complement of the sequence, we cannot simply also take the reverse complement of the signal: the reverse complement not only inverts the sequence, but also inverts the enzyme position convention. For a single symmetric convention, such as ATAC-seq, the inversion is still identical. However, for a non-symmetric convention, such as DNase-seq, the inversion led to two different conventions between the original data and the reverse complement-augmented data: right-hand convention for the original data, and left-hand convention for the reverse complement-augmented data.

![Figure: Processing DNase-seq sequencing counts.](dnase.png "width=600 Schematic of DNase-seq using DNase I to measure chromatin accessibility, and its right-hand side cut site convention at 0 bp / +1 bp.")

This explained several phenomena we had observed. First, during evaluation of ChromBPNet, comparing model performance on ATAC-seq vs. DNase-seq, while the counts head prediction (= predicted total counts inside the 1 kb region) performance was comparable between the two assays (ATAC-seq: ~0.7 vs. DNase-seq: ~0.7; Pearson correlation; higher = better), the profile head prediction (= predicted distribution of the total counts, as a probability distribution; where counts x prediction = predicted signal) performance was significantly worse in DNase-seq (ATAC-seq: ~0.4–0.6 vs. DNase-seq: ~0.65–0.9; Jensen-Shannon distance (JSD); lower = better).

![Figure: Original ChromBPNet performance: ATAC-seq vs. DNase-seq.](chrombpnet_performance.png "width=600 Performance of the original ChromBPNet model trained on ATAC-seq vs. DNase-seq from ENCODE cell lines. Left: Counts head performance, evaluated by Pearson correlation (higher = better). Right: Profile head performance, evaluated by Jensen-Shannon distance (lower = better). While counts head performance is comparable (left), profile head performance in DNase-seq is consistently worse than in ATAC-seq (right).")

Second, this was also observed in benchmarks against other models: in comparison with AlphaGenome, which improved on ChromBPNet’s 1 bp profile predictions by only 1.6% in ATAC-seq but by 6.4% in DNase-seq (relative improvement in profile JSD).

![Figure: AlphaGenome vs. ChromBPNet.](AG_performance.png "width=600 Performance comparison between AlphaGenome vs. ChromBPNet on profile head predictions at 1 bp resolution, evaluated by Jensen-Shannon distance (JSD). Top: Comparison on DNase-seq tracks. Bottom: Comparison on ATAC-seq tracks. Value: Relative % improvement in performance. AlphaGenome saw large improvements (+6.4%) on DNase-seq track prediction over ChromBPNet, but saw only marginal improvements (+1.6%) on ATAC-seq track predictions.")

Third, we could artificially reproduce this performance gap: As the same original ChromBPNet model trained on K562 DNase-seq (using the unintentional convention-inversion during reverse complement-augmentation) as the baseline, we compared the model’s performance against those retrained on 6 different training data sources:

1. forward-only: the original ChromBPNet’s right-hand side (0/+1) convention training data, but _without_ the reverse complement-augmented data (i.e., half the training data)
2. reverse complement-only: the original ChromBPNet’s “right-hand side (0/+1)” convention training using the reverse complement-augmented data _only_ (i.e., the other half the training data; hence, in reality left-hand side (-1/0) convention)
3. full right-hand side (0/+1) convention
4. left-hand side (-1/0) convention
5. both-side (0 and -1/0 and +1) convention by assigning half count to both sides
6. both-side (0 and -1/0 and +1) convention by assigning full integer count to both sides (i.e., double the total counts).

We observed that using half the data (original, or augmented) improved profile performance (in K562 DNase-seq: original: 0.45 vs. forward-only/reverse complement-only: 0.50), while degrading counts head performance (original: 0.71 vs. forward-only/reverse complement-only: 0.68/0.69), since only half the data was used (the same drop was also observed in ATAC-seq: original 0.70 vs. forward-only/reverse complement-only: 0.68). The counts performance was fully recovered when the correct convention was applied across the full, double-augmented data using either right-hand or left-hand side convention (original: 0.71 vs. right-hand/left-hand: 0.71), while the improved profile head performance was maintained (forward-only/reverse complement-only: 0.50 vs. right-hand/left-hand: 0.50). Both both-side (0 and -1/0 and +1) conventions (half, full) showed recovered counts head performance (original: 0.71 vs. both-full/half: 0.70) and the highest profile head performance (forward-only/reverse complement-only/right-hand/left-hand: 0.50 vs. both-full/half: 0.56), due to smoothed profiles.

![Figure: ChromBPNet DNase-seq cut site convention.](chrombpnet_dnase.png "width=600 Performance evaluation of ChromBPNet trained on different training data. `original`: The original ChromBPNet model. `original-refactor`: The original ChromBPNet preprocessing, implemented in `chrombpnet-refactor`. `fr-only`: Forward-only (`--data-aug forward-only`), using the original ChromBPNet preprocessing without reverse complement-augmented data. `rc-only`: Reverse complement only (`--data-aug revcomp-only`), using the original ChromBPNet’s reverse complement augmentation data only. `right`: Corrected right-hand side (0/+1) convention. `left`: Corrected left-hand side (-1/0) convention. `both-half`: Both-side (0 and -1/0 and +1) convention, assigning half count to both sides. `both-full`: Both-side (0 and -1/0 and +1) convention, assigning full integer count to both sides. Red: Counts head performance, evaluated by Pearson correlation (higher = better). Blue: Profile head performance, evaluated by 1 - JSD (higher = better). Repeated in ATAC-seq and DNase-seq in the same cell line (K562) and primary cell type (stomach).")

Further, we also investigated the cross-evaluation between the newly trained models and their corresponding test set with the original model and its test set, by evaluating the newly trained models on the original model’s test set and vice versa. We observed that the right-hand side convention model performed the best on the original ChromBPNet model’s test set on both matched counts head prediction (original: 0.71 vs. right-hand: 0.71) and improved profile head prediction (original: 0.44 vs. right-hand: 0.49), followed by forward-only model with similarly improved profile head prediction but degraded counts head prediction (as trained on half the data). Both both-side conventions showed the same performance as the original model (original: 0.44 vs. both-half/full: 0.44), suggesting that the training scheme was effectively equivalent. And left-side convention and reverse complement-only performed the worst, with profile head prediction degrading dramatically as predictions were constantly off by one (due to convention differences), with only half the training data used by the reverse complement-only model. Lastly, evaluating the original ChromBPNet model on the newly processed test sets, the original model performed the best on the both both-side convention test sets, as well as the actual both-side models trained on its own data convention (original: 0.56 vs. both-half/full: 0.56), further confirming that the training schemes were effectively equivalent, and the original model was effectively predicting a both-side convention signal. The original model showed equally degraded profile head performance on right-hand and left-hand side conventions, suggesting a symmetric prediction off by half the counts.

![Figure: Cross-evaluation on the original test sets.](chrombpnet_dnase_cross_original_test.png "width=600 Newly trained models’ performance on the original ChromBPNet model’s test sets (left: original; right: original-refactor).")

![Figure: Cross-evaluation on the new test sets.](chrombpnet_dnase_cross_new_test.png "width=600 The original ChromBPNet model’s performance (left: original; right: original-refactor) on each newly trained model’s test set. `original`: The original ChromBPNet model. `original-refactor`: The original ChromBPNet preprocessing, implemented in `chrombpnet-refactor`. `fr-only`: Forward-only (`--data-aug forward-only`), using the original ChromBPNet preprocessing without reverse complement-augmented data. `rc-only`: Reverse complement only (`--data-aug revcomp-only`), using the original ChromBPNet’s reverse complement augmentation data only. `right`: Corrected right-hand side (0/+1) convention. `left`: Corrected left-hand side (-1/0) convention. `both-half`: Both-side (0 and -1/0 and +1) convention, assigning half count to both sides. `both-full`: Both-side (0 and -1/0 and +1) convention, assigning full integer count to both sides. Red: Counts head performance, evaluated by Pearson correlation (higher = better). Blue: Profile head performance, evaluated by 1 - JSD (higher = better). Repeated in ATAC-seq and DNase-seq in the same cell line (K562) and primary cell type (stomach).")

From the investigation, we could conclude what was happening: the model, (unintentionally) trained on half right-hand side convention (from the original data) and half left-hand side convention (from the reverse complement-augmented data), was predicting an expectation between the two data conventions, which happened to coincide with the both-side convention.

__Solution__: Moving forward, we have implemented the following fixes and suggestions:
- DNase-seq cut site convention is now an optional argument (`--dnase-convention`): `right` (for right-hand side), `left` (for left-hand side), `both-half` (for both-side, with half counts each; default), `both-full` (for both-side, with full integer counts each), and `right-deprecated` (the original ChromBPNet’s behaviour, kept only to reproduce earlier runs). `--data-aug` separately chooses which examples are reverse complemented (`augment`, the default; `forward-only`; `revcomp-only`). This allows for all conventions to be possible during training as needed (user should remember which convention was used..!). The default setting is now `both-half` (for reasons explained next).
- Previously trained ChromBPNet models predict a `both-half`-like convention. (And new, refactored default models will be backwards-compatible). We are currently in the process of updating the training, validation, and test set observed signals, as well as the correct convention-based model performance evaluations. We plan to share another update once this is ready.

## 3. Anthropic’s Claude Fable/Mythos 5.1 optimizations: Fused kernels and faster I/O (mostly faster I/O)

An exciting side-project to this refactoring was hearing about Anthropic’s recent [model release of Fable/Mythos 5.1](https://www.anthropic.com/claude-fable-and-mythos-5-1) and their case study of optimizing several DNA sequence models—including ChromBPNet. We always welcome any and all improvements to our models from the community, and thought that this refactoring opportunity would be a great chance to deep dive into Fable/Mythos’ suggestions and incorporate them as needed. Anthropic’s optimizations were [released on Sep 17, 2026](https://github.com/anthropics/uplifting-biomolecular-modeling/).

![Figure: Anthropic Claude Fable/Mythos 5.1 model release.](fable_mythos.png "width=600 Inference speedup for seven open-source protein and genomics models on an NVIDIA H100, as part of Claude Fable/Mythos 5.1 model release.")

__Problem__: Anthropic’s optimizations focused on drop-in optimization kits that speed up the inference pipeline of existing DNA sequence models. This includes preprocessing input data, loading model weights, model inference, any post-processing output data, and final write of the output file. For ChromBPNet, this meant optimizing the prediction pipeline `pred_bw`, which predicts over a set of regions and writes the predictions as BigWigs. The optimization kit reported a 1.6x speedup over the original implementation, on an NVIDIA H100.

Below is a summary of changes applied in the [optimization kit](https://github.com/anthropics/uplifting-biomolecular-modeling/tree/main/chrombpnet) from the model release of Fable/Mythos 5.1:

| Kit optimization | What it does | Measured effect (vs. original `chrombpnet`) on L40S | On H200 | Applied in `chrombpnet-refactor`? |
|---|---|---|---|---|
| `prefetch` | Reads the genome through a memory map; one-hot encodes with an int8 lookup table | Featurization 15x faster (3.6 s → 0.2 s) | 15x (3.6 s → 0.2 s) | ✓ |
| `metrics_stage` | Computes the profile JSD for all regions at once, with the same random stream | Metrics 10x faster (9.8 s → 1.0 s) | 10x (9.1 s → 0.9 s) | ✓ |
| `bigwig_writer`, side processes | Writes the bigWig and metrics in a separate process, during the GPU forward | bigWig write hidden under the forward (23 s → 0.6 s left to wait) | 22 s → 0.6 s | ✓ |
| `preimport` | Imports SciPy and Matplotlib on a background thread during the forward | 1.3 s of imports hidden under the forward | 1.8 s | ✓ |
| `exit_fast` | Exits without interpreter and CUDA teardown once outputs are verified | Teardown skipped (1.2 s → 0 s) | 1.2 s → 0 s | ✓ |
| `forward_route` (`chrombpnet_k1` Triton kernels) | Fused, fp32-exact Triton forward | Forward 2.3x faster (34 s → 15 s, `exact`) [refactor: no gain, 120 s → 121 s] | 2.6x (25 s → 9.5 s, `fast`) [refactor: 106 s → 114 s] | Optional (`--predict-fused-kernel`) |
| `h5_writer` | Compresses the predictions HDF5's chunks on a thread pool and writes them directly | HDF5 write 17x faster on the critical path (3.7 s → 0.2 s) | 14x (3.4 s → 0.2 s) | ✓ (gzip 9 + shuffle, every large HDF5 dataset) |
| `malloc_env` | glibc allocator settings: no `mmap`, no heap trimming, a 512 MiB top pad | [refactor: 1.06x, 76 s → 72 s] | [refactor: 1.12x, 66 s → 59 s] | ✗ (peak memory doubles: 5.0 → 9.8-11.7 GB) |
| `warmup`, `jit_cache`, `native_dilation`, `tail` | One forward per batch shape at load time; a CUDA JIT cache for TensorFlow's PTX; dilated convolutions as native `conv2d`; the last batch padded to full size | – | – | – (TensorFlow-specific, or no time saved) |
| **All adopted kit changes** (excluding the Triton forward) | | **1.7x (`fast`: 85 s → 50 s) [refactor: 1.3x, 155 s → 120 s]** | **– (both kit modes run the Triton kernels) [refactor: 1.2x, 128 s → 106 s]** | ✓ |
| **Adding the fused kernels** (with every other optimization, including Section 4's) | | **2.8x (`exact`: 85 s → 30 s) [refactor: 3% slower, 76 s → 79 s]** | **3.7x (`fast`, TF32: 76 s → 20 s); 2.6x in fp32 (`exact`: 29 s) [refactor: 10% slower, 66 s → 73 s]** | Optional |

_Original `chrombpnet`: the kit's pinned chrombpnet 1.0.1 with its own model (GM12878 ATAC-seq, fold 0), running `pred_bw` on 20,000 ENCSR868FGK peaks at batch size 256; medians of 5 rounds on an L40S and an H200 (SXM). The kit cannot turn on one change at a time, so each row compares the time of one stage in stock chrombpnet and in the kit's default `fast` mode; for stages the kit runs alongside the forward pass, only the time left waiting counts. The totals compare the kit's modes with `--mode off` (85 s on the L40S, 76 s on the H200). On the L40S, `fast` keeps TensorFlow's forward and `exact` uses the kit's fp32 Triton kernels; on the H200 both modes use the Triton kernels (`fast` in TF32), so the kit's other changes cannot be timed without them there. In brackets, `chrombpnet-refactor`: `pred_bw` with each fold's three models (bias, ChromBPNet, no-bias) on 20,000 ENCSR868FGK peaks (K562 ATAC-seq); medians of 15 runs (5 folds × 3 rounds) against an unoptimized run (155 s on the L40S, 128 s on the H200). Every configuration ran in the same job, after an untimed warm-up and in a different order each round._

While the kit's speedup is very useful for users of the original package (1.7x on an L40S, 2.8x with its fused kernels; 3.7x on an H200, where its default mode runs them), interestingly, in our port most of the kit’s gain came not from faster model inference but by running CPU I/O in parallel with GPU inference: writing each model’s BigWig and metrics in a worker process while the next model predicts (~8% of wall clock), and importing the post-processing libraries in the background (~11%). If allowing for flexible file size and constraining only for identical value, the write of the BigWig could be further sped up by 3.1x with 1.5x smaller files using fixed-step bigWigs (implemented in Section 4; not part of Anthropic's optimization kit). Further, the kit's fused kernels did not actually show speed up in our port: `pred_bw` took 79 s with them and 76 s without on an L40S, and 73 s against 66 s (10% longer) on an H200, with only some very minor gains in numerical accuracy, using fp32-exact kernels (vs. eager TF32 convolutions). In the original package they replace TensorFlow 2.8's forward and cut it from 34 s to 15 s on an L40S; in ours they replace PyTorch's, which is already as fast. Given the limited use of the kernels, we kept them as optional (can be used with `--predict-fused-kernel`).

## 4. Additional optimizations in pre- and post-processing

Further, we have implemented several additional optimizations in the pre- and post-processing workflows, including vectorized GC-matched non-peak selection, faster and smaller BigWigs with fixed-step sections, a shared, cleaner command line, and one random seed per command for deterministic reproducibility:

| Change | What it does | Measured effect on L40S | On H200 |
|---|---|---|---|
| Shared inputs across models (`pred_bw`) | Featurizes the regions and reads the observed bigWig once for all models | 2.9x faster (13.0 s → 4.5 s) | 2.9x (12.8 s → 4.4 s) |
| Fixed-step bigWigs | The same values, written as fixed-step instead of variable-step sections | 3.1x faster (21.2 s → 6.8 s); files 1.5x smaller (158 → 109 MB) | 3.1x (19.6 s → 6.2 s) |
| NumPy bigWig writer arguments | Builds the writer's arguments as arrays | 1.1x faster (21.2 s → 19.7 s) | 1.1x (19.6 s → 18.2 s) |
| Batched cast into a preallocated output | Casts and transposes each batch as it is needed | 1.0x (15.1 s → 15.1 s); 714 MB less peak memory | 1.1x (6.3 s → 5.9 s) |
| **All of the above** (`pred_bw`, without the kit's changes) | | **1.6x faster (155 s → 97 s)** | **1.7x (128 s → 76 s)** |
| **Together with the kit's changes** | | **2.0x faster (155 s → 77 s)** | **1.9x (128 s → 66 s)** |
| Maximum HDF5 compression (the default) | `*_predictions.h5`, `*_scores.h5`, `*_footprints.h5` and TF-MoDISco's results at gzip 9 (was 4) with byte-shuffle; identical values | Files 1.2x smaller (92 → 76 MB); written on threads, 7.7x faster than on one (23.8 s → 3.1 s), so `pred_bw` is no slower (77 s → 76 s) | 7.5x (21.9 s → 2.9 s); `pred_bw` 66 s → 66 s |
| **Fully optimized `chrombpnet-refactor` (the default) vs. original `chrombpnet`** | Every optimization above and in Section 3, vs. chrombpnet 1.x (TensorFlow 2.8) on its own models, in the same job | **2.6x faster (194 s → 76 s)** | **2.6x (168 s → 66 s)** |
| GC-matched non-peaks (`prep nonpeaks`: a separate, CPU-only command, run once per fold before training; not part of `pred_bw`) | Candidates as compact arrays, shuffled once per fold, sorted by GC bin and drawn without replacement, with a binary search for the nearest non-empty bin | Matching 54x faster (200 s → 3.7 s); peak memory 1.3 → 0.4 GB; fails with an error where the original could loop forever | 52x (192 s → 3.7 s) |
| One `-s/--seed` per command | Every random draw (negatives, initial weights, jitter, interpretation subsample, DeepLIFT/DeepSHAP references) follows it | Same seed and flags: identical outputs on the CPU | – |
| Command line | One shared, framework-neutral pipeline behind `--engine` and `--device`; options validated before any output directory is created | – | – |

_The bold `pred_bw` rows come from the same runs as the bracketed numbers in Section 3 (5 folds × 3 rounds, one job per GPU, the original package included). The other rows time one change at a time, old version against new, on fold 0: each in a fresh process, in a different order each round, medians of 3 rounds (2 for GC matching). CPU-only steps, including `prep nonpeaks`, depend on each GPU node's CPUs. HDF5 sizes are for one model's `*_predictions.h5` for 20,000 peaks._

Against the original ChromBPNet (TensorFlow 2.8, as shipped), on the same GPU (an L40S) and folds. cherimoya writes no predicted bigWigs or HDF5 files, so it is compared only on the head-to-head rows (↳), where each chrombpnet package runs its own command with those writers switched off:

| Command (L40S) | Original ChromBPNet | chrombpnet-refactor (PyTorch) | cherimoya |
|---|---|---|---|
| `pred_bw`: 3 models, 20,000 peaks; predicted bigWigs, predictions HDF5, metrics against the observed bigWig | 194 s | 76 s (2.6x) | – (no equivalent) |
| ↳ head-to-head: one model's predictions over the 20,000 peaks, scored against the observed bigWig; nothing written (cherimoya `evaluate`) | 54 s | 29 s (1.8x) | 15 s (3.6x) |
| `contribs_bw`: DeepLIFT/DeepSHAP on the profile head, 2,000 peaks; scores HDF5 and bigWig | 341 s | 257 s (1.3x) | – (no equivalent) |
| ↳ head-to-head: the attributions alone, 20 shuffled references per sequence; nothing written (cherimoya `attribute`) | 334 s | 252 s (1.3x) | 161 s (2.1x) |

_In parentheses: the speedup over the original ChromBPNet. `pred_bw`: the same runs as in Sections 3 and 4. `contribs_bw` and the head-to-head rows: one job over the same 5 folds, medians of 15 runs (5 folds × 3 rounds) per command, each after an untimed warm-up and in a different order each round. cherimoya 0.3.1 (PyTorch 2.13, in a container on our cluster) ran its own commands on the same inputs with CATv1's ENCSR868FGK models, which use the same folds; medians of 15 runs (5 folds × 3 rounds) after an untimed warm-up, which also compiles its kernels (2-7 minutes the first time on a machine). Its `evaluate` predicts with one model (cherimoya has no bias factorization) and writes only a table of metrics; its `attribute` uses DeepLIFT/DeepSHAP with 20 dinucleotide-shuffled references per sequence, as chrombpnet's DeepLIFT/DeepSHAP does, and writes NumPy arrays. In the head-to-head rows, chrombpnet's `pred_bw` uses the full model only._

## Reproducibility: Confirming parity with the original ChromBPNet

Given all the changes, we confirmed performance parity with the original [ChromBPNet](https://github.com/kundajelab/chrombpnet/) based on reproducibility on: (1) test set chromosome performance, and (2) model interpretation via DeepLIFT/DeepSHAP contribution scores.

Reproducibility of model performance is evidently important. Comparing the performance of the models trained on the refactored codebase (using the default `both-half` convention for DNase-seq), across all 3 deep learning engines (PyTorch, TensorFlow, JAX) against the (pretrained) original ChromBPNet model and an original ChromBPNet model retrained with the original codebase (the run-to-run reference): we observe near-perfect reproducibility across all 3 engines, in ATAC-seq and DNase-seq, in cell lines (K562) and primary cells (stomach), on counts/profile head performance, across all 5 chromosome folds. DNase-seq profile scores rise (K562: 0.33 to 0.48; stomach: 0.23 to 0.35, 1 - JSD) because the refactored models are trained and evaluated on the `both-half` signal: the original model scores as well on that test set (cross-evaluation above), so the gain reflects the evaluation target rather than a better model.

![Figure: Refactored ChromBPNet vs. original ChromBPNet: Test set performance.](chrombpnet_engine_performance.png "width=600 Comparing test set performance of the original ChromBPNet model vs. a retrained original ChromBPNet model and 3 refactored ChromBPNet models on all 3 deep learning engines: PyTorch, TensorFlow, JAX. `original`: The original ChromBPNet model trained as part of ENCODE GRAMMAR. `original (newly trained)`: A newly trained ChromBPNet model using the original codebase. `pytorch`: A refactored ChromBPNet model using PyTorch. `tensorflow`: A refactored ChromBPNet model using TensorFlow. `jax`: A refactored ChromBPNet model using JAX.")

The robust model interpretation methods have been a key advantage of ChromBPNet, and hence reproducibility of model contribution scores was key. Comparing the DeepLIFT/DeepSHAP contribution scores from each model against the original ChromBPNet’s DeepLIFT/DeepSHAP scores, we observe that contribution scores can be difficult to reproduce perfectly, with only 20 reference sequences (optimized between reproducibility and compute). To quantify the variance in DeepLIFT/DeepSHAP contribution scores, we observed that DeepLIFT/DeepSHAP scores calculated using the same original, pretrained ChromBPNet model, but with simply a different random seed, could achieve a high but not perfect reproducibility (Pearson correlation: 0.86). Further, with a newly trained model, retrained using the same original ChromBPNet codebase, could only reach a reproducibility of 0.72 correlation, setting the expected upper bound for any reproducibility from a model trained on a changed codebase. Our refactored ChromBPNet codebase reaches this contribution score reproducibility: 0.71–0.72 across the 3 deep learning engines (PyTorch 0.711, TensorFlow 0.722, JAX 0.715). This confirmed the reproducibility of the refactored ChromBPNet codebase across test performance and contribution scores.

![Figure: Refactored ChromBPNet vs. original ChromBPNet: DeepLIFT/DeepSHAP contribution scores.](chrombpnet_engine_contribution.png "width=600 Comparing reproducibility of the original DeepLIFT/DeepSHAP contribution scores from the original ChromBPNet model vs. a retrained original ChromBPNet model and 3 refactored ChromBPNet models on all 3 deep learning engines: PyTorch, TensorFlow, JAX. Counts hypothetical: DeepLIFT/DeepSHAP score based on the counts head, across all possible bases and positions. Counts projected: DeepLIFT/DeepSHAP score based on the counts head, on the reference genome bases and positions. Profile hypothetical: DeepLIFT/DeepSHAP score based on the profile head, across all possible bases and positions. Profile projected: DeepLIFT/DeepSHAP score based on the profile head, on the reference genome bases and positions. `original`: The original ChromBPNet model trained as part of ENCODE GRAMMAR. `original (newly trained)`: A newly trained ChromBPNet model using the original codebase. `pytorch`: A refactored ChromBPNet model using PyTorch. `tensorflow`: A refactored ChromBPNet model using TensorFlow. `jax`: A refactored ChromBPNet model using JAX.")

## 5. Supplementary: Additional improvements to model structure and usability (that deviate from original ChromBPNet)

Lastly, we’ve added a few non-backward compatible improvements to the model (that will remain optional, given the demand for backward compatibility), but we _highly recommend_ using them moving forward.

### Profile-only bias model

The original ChromBPNet pretrained a small bias model to learn the sequence preference of the assay enzyme (DNase-seq: DNase I, ATAC-seq: Tn5 transposase), predicting the enzyme’s effect on both the total accessibility reads across 1,000 bp window (counts head prediction) and on the distribution of the sequencing reads (profile head prediction). However, the enzyme’s bias is typically not strong enough to affect the general accessibility of a broad, 1,000bp window (e.g., it does not newly open closed chromatin). Its effects are largely local, applying a local preference once it accesses already open chromatin, shifting the signal toward its preferred sequences. Hence, after training many ChromBPNet models for ENCODE GRAMMAR, we observed that the bias model (which is mostly fixed across ENCODE GRAMMAR for each assay type anyway, as enzyme bias is largely constant across cell type environments) was largely contributing nothing towards the counts head predictions, and almost exclusively contributing to the profile head predictions. This is also in alignment with its training: 1) The bias model is pretrained on nonpeaks only, so its trained dynamic range is highly limited. 2) A “good” bias model often showed strong profile head performance, but could show very poor counts head performance, often even with negative correlation (i.e., predicting in the “opposite” direction of a tiny accessibility signal; suggesting noise). Hence, instead of contributing non-predictable counts “noise”, as well as confound gradients during training, in `chrombpnet-refactor`, we now train a bias model that predicts reads distribution _only_ (profile head only), and is connected only to the profile head prediction of the full ChromBPNet model.

![Figure: Enzyme bias model: Performance & total counts head prediction by the bias model across 1,512 ENCODE GRAMMAR ChromBPNet models.](chrombpnet_bias_counts.png "width=600 1. Counts predicted by the three main ENCODE GRAMMAR bias models on held-out chromosomes, against total observed counts: nearly the same in peaks (red) as in non-peaks (blue). 2. Total predicted counts with vs. without the bias model, across 1,502 ENCODE GRAMMAR ChromBPNet models: the bias model adds a median 11.5%.")

### Student-Teacher distillation

Another learning from ENCODE GRAMMAR (and following the advantages shown by related models e.g., AlphaGenome): instead of using all k-fold models (from cross-validation) as an ensemble for downstream tasks (e.g., bias-corrected prediction, contribution scores), we can now reliably distill each fold model (as a Teacher) into one (Student) model, by training on the k-fold ensemble’s mean predictions. The main benefit of condensing k-fold folds into one model is the ease of use: instead of repeating k x downstream processes, then ensembling the average, downstream processes only need to be performed once on the Student model—without losing much of the benefits of ensembling.

To assess the reproducibility of distillation to match ensembling, we repeat the prediction and contribution score analysis above, observing highly reproducible results by distillation.

![Figure: Ensembled (5-fold) ChromBPNet vs. Distilled Student ChromBPNet: Reproduciblity of test set predictions & DeepLIFT/DeepSHAP contribution scores.](chrombpnet_distill_ensemble_student.png "width=600 Predictions (top) and DeepLIFT/DeepSHAP scores (bottom) of each model against the 5-fold ensemble mean, on ~10,000 shared peaks per dataset (higher = more reproducible). `fold model`: one fold model, against the 5-fold mean it is part of. `LOFO student`: distilled from the 5 fold models on fold k's training chromosomes. `final student`: distilled on every chromosome.")

With the new updates, we again repeat the prediction and contribution score reproducibility analysis above and observe similar reproducibility—confirming the reliability of the updates.

![Figure: Original ChromBPNet vs. `chrombpnet-refactor (default)` vs. `chrombpnet-refactor (updated)`: Test set predictions & DeepLIFT/DeepSHAP contribution scores.](chrombpnet_refactor_default_updated.png "width=600 Test set performance (top) and DeepLIFT/DeepSHAP scores against the original model's (bottom). `original`: the original TensorFlow model; `original (newly trained)`: retrained with the original codebase (white); `original (same model; diff seed)`: the original model rescored with another seed (grey). `chrombpnet-refactor (default)`: backward compatible (`pytorch` above). `chrombpnet-refactor (updated)`: profile-only bias model and Pearson r/JSD checkpoint selection.")

## [`chrombpnet-refactor`](https://github.com/kundajelab/chrombpnet-refactor/)

Overall, we share a reproducible, refactored version of [ChromBPNet](https://github.com/kundajelab/chrombpnet-refactor/): supporting all 3 major deep learning engines, a corrected DNase-seq cut site convention, several internal and external optimizations—all with confirmed reproducibility in model performance and contributions.

Moving forward, we recommend using the refactored ChromBPNet codebase for __all future use cases of ChromBPNet__. And we continue to invite any further improvements to the model and codebase!

## References
1. The ENCODE Project Consortium et al. The Encyclopedia of DNA Elements. _bioRxiv_ 2026.07.06.731365 (2026). ([https://doi.org/10.64898/2026.07.06.731365](https://doi.org/10.64898/2026.07.06.731365))
1. Pampari, A. et al. ChromBPNet: bias factorized, base-resolution deep learning models of chromatin accessibility reveal cis-regulatory sequence syntax, transcription factor footprints and regulatory variants. _bioRxiv_ 2024.12.25.630221 (2024). ([https://doi.org/10.1101/2024.12.25.630221](https://doi.org/10.1101/2024.12.25.630221))
1. Shrikumar, A., Greenside, P. & Kundaje, A. Learning Important Features Through Propagating Activation Differences. _arXiv_ (2019). ([https://doi.org/10.48550/arXiv.1704.02685](https://doi.org/10.48550/arXiv.1704.02685))
1. Lundberg, S. M. & Lee, S.-I. A unified approach to interpreting model predictions. in _Proceedings of the 31st International Conference on Neural Information Processing Systems_ 4768–4777 (Curran Associates Inc., Red Hook, NY, USA, 2017). ([https://dl.acm.org/doi/10.5555/3295222.3295230](https://dl.acm.org/doi/10.5555/3295222.3295230))

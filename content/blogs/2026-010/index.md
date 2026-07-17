---
post_id: "2026-010"
title: "Chorus: chatting with genomic oracles"
image: "chorus_main.png"
math: false
authors: ["Dmitry Penzar", "Lorenzo Ruggeri", "Jiecong Lin", "Rosalba Giugno", "Luca Pinello"]
authors_display:
  - name: "Dmitry Penzar"
    affiliation: "Vavilov Institute of General Genetics, Moscow"
    orcid: "0000-0001-7960-9385"
  - name: "Lorenzo Ruggeri"
    affiliation: "Sapienza University of Rome"
    orcid: "0009-0000-2516-1175"
  - name: "Jiecong Lin"
    affiliation: "Changping Laboratory, Beijing"
    orcid: "0000-0003-3347-837X"
  - name: "Rosalba Giugno"
    affiliation: "University of Verona"
    orcid: "0000-0001-9843-7638"
  - name: "Luca Pinello"
    affiliation: "Harvard Medical School, Massachusetts General Hospital, and the Broad Institute"
    orcid: "0000-0003-1109-3823"
editor: ["Al-Murphy"]
tags: ["genomics", "seq2func", "variant-interpretation", "foundation-models", "AlphaGenome", "MCP", "agentic-AI"]
categories: ["Blog Post"]
scope: ["insights", "tutorials"]
audience: ["intro-to-field", "general"]
disciplines: ["Sequence-to-Function Modeling"]
labs: ["Pinello Lab"]
status: "submitted"
revision: 1
date_submitted: 2026-06-23
date_accepted:
date: 2026-07-17
doi: ""
zenodo_url: ""
revision_history:
  - version: 1
    date: 2026-06-23
    notes: "Initial submission"
    doi: ""
    zenodo_url: ""
  - version: 2
    date: 2026-07-17
    notes: "Updated after revision"
    doi: ""
    zenodo_url: ""
---

{{< summary >}}

Sequence-to-function models have become one of the most exciting developments in regulatory genomics: models like Enformer, Borzoi, ChromBPNet, and AlphaGenome can now predict chromatin accessibility, transcription factor binding, gene expression, histone modifications, and splicing directly from DNA sequence across hundreds of cell types. Using them together, however, has remained surprisingly difficult — each ships with its own repository, dependencies, input formats, track conventions, output resolutions, and hardware requirements, which puts comparative analysis out of reach for most clinicians and GWAS interpreters.

**Chorus** provides a unified framework that turns seven state-of-the-art models (ChromBPNet/BPNet, LegNet, Sei, Enformer, Borzoi, EPInformer-seq, and AlphaGenome) into interchangeable "oracles" with harmonised, cross-comparable outputs, and exposes every capability over the [Model Context Protocol](https://modelcontextprotocol.io/) so an AI agent can run them from plain language — a shift from computational to **conversational genomics**. Two worked examples show what that enables: in the first, an agent reconstructs the mechanism of a textbook regulatory variant (rs12740374 at *SORT1*) through conversation alone; in the second, it prioritises a likely causal variant inside a tight GWAS linkage block (rs9504151), recovering the same disrupted transcription factor an independent fine-mapping study reported.

We are also honest about where the predictions fall short: effect sizes come out too small, and a variant can only be assessed in the cell types the models actually cover.

**Code:** [github.com/pinellolab/chorus](https://github.com/pinellolab/chorus)

{{< /summary >}}

---

## Motivation

Interpreting noncoding variants is one of the central problems in human genetics: most GWAS associations and a large share of disease-relevant variants lie outside coding regions, making it difficult to understand how they influence biology. 

One important link between theoretical biology and personalized medicine is predicting the effects of regulatory variants. Unfortunately, this task cannot be addressed directly because only a small number of regulatory variant effects have been measured in a consistent and reliable way.
Therefore, the field has largely adopted a zero-shot approach. A sequence-to-function (seq2func) model is trained to predict molecular readouts directly from DNA sequence, such as chromatin accessibility, transcription factor binding, gene expression, or splicing. After that, to estimate the effect of a genetic variant, the model is run twice: once on the reference sequence and once on the sequence containing the variant. The difference between the two predictions is used as the predicted variant effect. In other words, it estimates how much the mutation changes regulatory activity of the region.

Models like [Enformer](https://www.nature.com/articles/s41592-021-01252-x), [Borzoi](https://github.com/calico/borzoi), [ChromBPNet/BPNet](https://github.com/kundajelab/chrombpnet), [Sei](https://github.com/FunctionLab/sei-framework), [LegNet](https://github.com/autosome-ru/LegNet), [EPInformer](https://www.nature.com/articles/s41467-026-70535-8) and [AlphaGenome](https://www.nature.com/articles/s41586-025-10014-0) can now predict chromatin accessibility, transcription factor binding, gene expression, histone modifications, and splicing directly from DNA sequence across hundreds of cell types. Using them together, however, has remained surprisingly difficult.


<!-- > *Side note:* a seq2func model learns a direct mapping from DNA sequence to one or more measured molecular readouts (accessibility, binding, expression, and so on). Train it on the genome and you can then ask it about sequences the genome never contained, which is exactly what variant interpretation needs. -->

Every model comes with its own ecosystem: a separate repository, dependency stack (TensorFlow, PyTorch, or JAX), input window (anywhere from 200b to 1 Mb), various sequence preprocessing and prediction postprocessing steps, track-naming convention, output resolution, and hardware requirements. Running a comparative analysis across models often means days of plumbing before you can even ask a biological question. That overhead is real even for computational biologists; for clinicians and GWAS interpreters, who want to examine a patient's variant or a credible set from a study, it is usually a hard stop. A standardized collection of models that is easy to install and run — paired with tools that run them efficiently and generate comprehensive reports highlighting the most probable explanations and the weak points that still need experimental validation — could greatly accelerate progress. This is the motivation behind Chorus.

Several prior efforts have sought to standardize access to sequence-to-function models, through each addresses a different piece of the puzzle. [Kipoi](https://www.nature.com/articles/s41587-019-0140-0) established a model repository and exchange format for genomics, making trained models findable and reusable. [PrixFixe](https://www.nature.com/articles/s41587-024-02414-w) address the problem of designing novel and effective deep-learning models. [tangermeme](https://www.biorxiv.org/content/10.1101/2025.08.08.669296v1) focuses on providing built-in, highly optimized atomic methods for
interpreting model predictions. [gRELU](https://www.nature.com/articles/s41592-025-02868-z) provides a library for training, interpreting, and deploying sequence-to-function models, streamlining the development side of the workflow. [GAME](https://doi.org/10.1101/2025.07.04.663250) (Genomics API for Model Evaluation) standardizes benchmarking through Predictors and Evaluators that communicate over a common API, with an LLM Matcher for cell-type and species alignment. Where these efforts focus on exchange, development, and evaluation, Chorus tackles a different problem: harmonized, cross-comparable variant interpretation through a conversational interface.

Chorus turns genomic sequence-to-function models into interchangeable *oracles*. You describe a biological question in plain language, and Chorus selects the appropriate model, handles all preprocessing and dependency management, and returns results in a consistent format. Analyses that previously required stitching together multiple pipelines across days can now be completed in an afternoon, through conversation alone.

![Chorus turns seven sequence-to-function models into interchangeable oracles and lets an AI agent orchestrate them from natural language.](./fig_architecture.png "Figure 1. Chorus exposes seven seq2func oracles behind one interface and an agentic layer. The same analysis can be driven programmatically through a unified Python API or conversationally through an MCP server.")

---

## Chorus Framework

Chorus provides a unified framework for sequence-to-function models through a standardized **oracle** abstraction. Every model becomes an interchangeable genomic oracle: you hand it a genomic region or a DNA sequence and a set of tracks, and it returns predictions across the modalities it supports. Switching models is a single argument. Under the hood, Chorus handles dependency isolation, environment management, and the model-specific preprocessing each one demands; from the outside, all of that disappears behind one small Python API.

Three concepts carry the design:

- **Oracle.** A common interface implemented by every model. `oracle.predict(interval, tracks)` is the primitive that everything else is built on. Each oracle runs in its own isolated conda environment, so the TensorFlow, PyTorch, and JAX models never fight over dependencies.
- **Interval.** A unified handle on genomic coordinates and the reference sequence, with an edit history. An interval tracks the substitutions, insertions, and deletions you apply alongside the predictions they produce, which is what makes in silico perturbation reproducible rather than a pile of ad hoc FASTA files.
- **Track.** A named genomic signal (DNase, ATAC, ChIP, CAGE, RNA-seq, and so on). A track is implicitly an (assay x cell type/tissue) pair, such as "DNase in HepG2" or "CAGE in lung fibroblasts". Track identifiers differ across oracles, so Chorus provides metadata search to find the right ones. The Track class supports several common and useful operations, such as changing the track resolution to compare predictions from different models.

These seven oracles span a wide range of context windows and resolutions, which is exactly why having them under one roof is useful: you can pick the right tool for the layer you care about without rewriting your analysis.

| Oracle | Input window | Resolution | What it is good at |
|---|---|---|---|
| **ChromBPNet / BPNet** | 2,114 bp | 1 bp | Chromatin accessibility (ChromBPNet) and TF binding (BPNet) at base-pair resolution |
| **LegNet** | 200 bp | element-level | MPRA / reporter activity of short regulatory elements |
| **EPInformer (EPInformer-seq implementation)** | 2,114 bp* | 1 bp (DNase/H3K27ac); element-level (DNase–H3K27ac composite) | Compact per-cell enhancer activity (DNase cut-sites + H3K27ac) across 11 Roadmap cell types |
| **Sei** | 4,096 bp | region-level | Regulatory effect across 21,907 chromatin profiles |
| **Enformer** | 196,608 bp | 128 bp | Expression (CAGE), accessibility, histone marks across long context |
| **Borzoi** | 524,288 bp | 32 bp | Enformer-style outputs plus RNA-seq coverage |
| **AlphaGenome** | 1,048,576 bp | 1 bp | Generalist: ATAC, DNase, CAGE, RNA-seq, splicing, PRO-CAP, and ChIP for histones and TFs (5,731 tracks) |

*Chorus uses the [EPInformer-seq implementation](https://github.com/pinellolab/EPInformer/blob/main/EPInformer/epinformer_seq_v2.py), which accepts a single 2,114-bp sequence as input and predicts DNase and H3K27ac profiles over the central 1,024 bp. This differs from the original EPInformer architecture, which predicts gene-expression taking a promoter together with candidate enhancers spanning a broader (~100 kb) regulatory context.

There is one more piece that makes cross-model work honest. Raw model outputs are not comparable: a "+1.3" from one track means something different from a "+1.3" from another. Chorus scores every prediction against a per-track genome-wide background (built from thousands of random variants and genomic sites), turning a raw log2 fold-change into two interpretable numbers: an **effect percentile** (how unusual this variant's effect is relative to random SNPs, an approac inspired by the one used in AlphaGenome paper)  and an **activity percentile** (how active the site is to begin with). For the genome-browser view, the same backgrounds rescale every track onto one shared display axis, where 1.0 marks roughly the top one percent of bins genome-wide and 0 sits at a per-layer activity floor. After this normalisation, effects and signals become comparable across cell types, variants, tracks, and oracles, and the browser can show every oracle's reference and alternate signal on a single axis.

---

## From computational to conversational genomics

Chorus also adopts an approach that fundamentally changes how these models get used and makes them even easier to reach: a conversational layer. It ships an [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server that exposes every capability as a tool an AI agent can call. Once it is connected, you can ask the genome what a variant would do in plain language, and the agent picks the oracle, selects tracks, runs the prediction, and explains the result.

The MCP server exposes 24 tools, grouped by what they do. The low-level set handles discovery (`list_oracles`, `list_tracks`, `list_genomes`, `get_genes_in_region`, `get_gene_tss`), oracle lifecycle (`load_oracle`, `unload_oracle`, `oracle_status`), raw prediction (`predict`, `predict_variant_effect`, `predict_region_replacement`, `predict_region_insertion`), scoring primitives (`score_prediction_region`, `score_variant_effect_at_region`, `predict_variant_effect_on_gene`, `score_ism` for in-silico saturation mutagenesis), and a backend helper (`recommend_alphagenome_backend`, which suggests the JAX vs PyTorch AlphaGenome backend for a given window size).

Above these are the high-level analysis tools that power the worked examples below, the ones most users actually call:

- `analyze_variant_multilayer` — score a variant across chromatin, TF, histone, CAGE, RNA, and splicing in a single call
- `discover_variant` and `discover_variant_cell_types` — find the top tracks, or screen hundreds of cell types, for a variant without pre-selecting assays
- `score_variant_batch` — rank a whole VCF, GWAS set, or credible set by effect
- `fine_map_causal_variant` — prioritise the causal SNP in a GWAS locus using multi-layer convergence (this is the tool behind the second worked example below)
- `analyze_region_swap` and `simulate_integration` — score sequence-engineering edits such as promoter swaps and construct insertions

This means an analyst can ask: which cell type's accessibility changes most for this variant, which transcription factor is gaining or losing a site, which nearby gene moves, does this edited enhancer behave like the wild type. No code, and the same questions map onto whichever oracle is best suited to answer them.

The two sections below are worked examples of exactly that.

---

## Reproducing a Nature paper in an afternoon

We started from a simple question: could an agent equipped with Chorus reconstruct the mechanism behind a classic regulatory variant through conversation alone?

The test case is **rs12740374** at the 1p13 locus, the subject of a [2010 Nature paper](https://doi.org/10.1038/nature09266) by Musunuru and colleagues. The original work showed that this noncoding SNP creates a liver-specific C/EBP (C/EBPα) binding site, raises *SORT1* expression in hepatocytes, and ultimately shifts LDL cholesterol and myocardial infarction risk. The SNP sits in a roughly 6 kb noncoding stretch between CELSR2 and PSRC1; SORT1, the gene it ultimately controls, is a more distal neighbour in the same cluster, a detail that matters below. Establishing the mechanism took a battery of experiments: eQTL analysis, reporter assays, chromatin immunoprecipitation (ChIP), electrophoretic mobility shift assays (EMSA), and overexpression and knockdown studies in mouse liver.

We reproduced the core of it in an afternoon, in a chat. Working in Claude Code with the Chorus MCP server connected, the analysis unfolded one question at a time.

**Step 1, which cell type opens up?**

> **Prompt:** Score chr1:109274968 G>T using ChromBPNet. Which cell types change chromatin accessibility the most?

The agent loaded ChromBPNet on its own and reported that the variant strongly increases predicted accessibility, with a large effect in **HepG2**, a liver-derived line — among the strongest of the cell types it covers. That matches the paper's central claim that the mechanism is liver-relevant. (Across the human ChromBPNet DNase models, HepG2 is co-highest by effect-percentile; the fibroblast line IMR-90 shows a comparable-to-larger raw effect, so we avoid claiming HepG2 is uniquely the largest.)

**Step 2, which factor binds?**

> **Prompt:** HepG2 looks interesting. Which transcription factor's predicted binding changes most at the variant?

The strongest signal came from the **C/EBP** family. We gave no prior about which factor to look for: AlphaGenome scores its whole panel of TF-ChIP tracks, so it can surface C/EBP straight from sequence (CEBPB and CEBPA top the HepG2 TF panel), and a C/EBP-specific BPNet head then confirms the gain. In the 2010 study, nailing this down required EMSA and ChIP to show that C/EBP binds the site created by the minor allele.

![AlphaGenome TF-ChIP scan for rs12740374 in HepG2, with no prior.](./fig_sort1_tf_scan.png "Figure 2. AlphaGenome's HepG2 TF-ChIP scan for rs12740374, given no prior about which factor to look for. The C/EBP family tops the ranking (CEBPB +3.1, CEBPA +2.8, CEBPG +2.3, CEBPD +1.9) — the binding site the minor allele creates.")

**Step 3, which gene is affected the most, and why only a long-context oracle can answer**

> **Prompt:** Which nearby gene's expression is most affected? Use a long-context oracle with CAGE and RNA-seq.

This step is worth pausing on, because it is the one place where the choice of oracle is not optional. As noted above, rs12740374 sits between CELSR2 and PSRC1, and the SORT1 promoter is roughly 100 kb away (≈118 kb to the nearest SORT1 TSS in hg38). Linking the variant to *SORT1* therefore requires two capabilities:
1. The model must predict gene-expression-related outputs such as CAGE or RNA-seq.
2. The relevant promoter must fall within the model's output window.

Many powerful sequence-to-function models fail one of these criteria.
ChromBPNet and LegNet do not model gene expression at all: they are designed to measure local chromatin accessibility and short-sequence reporter activity, respectively.
Even among expression models, genomic context matters. Enformer's input window can accommodate both the variant and the SORT1 promoter. Placing the variant near the start of the 196,608 bp input puts the SORT1 TSS (roughly 118 kb away) within the central 114 kb output crop, so the model could in principle report an effect on the promoter. In practice, however, Enformer struggle to reliably capture regulatory effects spanning such long distances (see **Distal targets need long context** in **Limitations** section or [Karollus et al., 2023](https://doi.org/10.1186/s13059-023-02899-9)); in our tests Enformer predicts essentially no change in liver CAGE signal at the SORT1 promoter for this variant.

Chorus handles this decision automatically. During oracle selection, Chorus checks whether the genomic feature required by the user's question falls within the candidate model's effective output region. If the target gene lies outside that range, Chorus recommends switching to an oracle with a sufficiently large output window. This is why, for this analysis, the gene-level prediction was obtained from AlphaGenome.

The top hit was **SORT1**, with increased predicted promoter and transcript signal in HepG2.

At that point the mechanistic story had assembled itself through conversation: the minor allele opens chromatin in liver cells, creates a C/EBP site, and upregulates *SORT1*. AlphaGenome alone could have recovered essentially this entire chain of evidence. But relying on a single model leaves open the question of whether the result is a genuine biological signal or a model-specific artefact. The power of Chorus is that it lets us ask the same question across multiple oracles with different inductive biases. To make the result robust rather than a single model's opinion, we then scored the variant across three independent oracles, each contributing only the layers it can actually measure: ChromBPNet for local accessibility, LegNet for MPRA reporter activity, and AlphaGenome as a generalist covering ChIP, histones, CAGE, and, thanks to its 1 Mb window, the distal *SORT1* promoter. This multi-model convergence is exactly the kind of cross-validation that is typically expensive and time-consuming to set up; Chorus makes it conversational.

![Multi-oracle readout for rs12740374 next to the 2010 experimental ground truth.](./fig_sort1_comparison.png "Figure 3. The per-layer multi-oracle readout for rs12740374, placed next to the experimental ground truth from Musunuru et al. (2010). The models recover the direction and the mechanism at every layer; the one place they fall short is magnitude.")

![Every oracle's signal on a single genome-browser axis across the SORT1 locus.](./fig_sort1_browser.png "Figure 4. Every oracle's signal on one normalised genome-browser axis across the SORT1 locus (chr1:109.15–109.45 Mb): ChromBPNet DNase, LegNet MPRA, and AlphaGenome H3K27ac / CAGE / CEBPA / DNase, with the G>T variant marked (red). After per-track quantile normalisation the tracks are directly comparable; the signal concentrates at the variant and the CELSR2/PSRC1 enhancer, while SORT1 (~100 kb away) is reached only by AlphaGenome's long window.")

### Predictions next to ground truth

Figure 3 places prediction and ground truth side by side: what Chorus predicted in silico against what the original study measured at the bench. Read top to bottom, the agreement is striking. Without any prior assumptions, the oracles recover the cell type, the transcription factor, the chromatin and histone changes, the reporter direction, and the target gene, all of which originally took dedicated assays to establish.

> **Reproducibility note.** ChromBPNet's accessibility number is scored on its native 2,114 bp window: the article reports **+1.24**, and a fresh re-run on current chorus gives **+1.37** (~10% relative drift, within tolerance). We expect this range of variation from floating-point arithmetic differences across GPU/CPU runs, and numerical precision in window positioning. The direction and approximate magnitude are stable. On chorus `main` the conversational path does this automatically — just ask for the variant, no manual window needed. The underlying commit/PR detail lives in the linked reproduction report.

The honest caveat is the magnitude of the *SORT1* effect itself. The models get its **direction** right at every layer, but **underestimate the size** badly: a small predicted increase, well under 2-fold, against the more than 12-fold higher SORT1 mRNA expression observed in human liver samples (Musunuru et al., 2010, Figure 1d). That 12-fold increase comes from qPCR measurement of endogenous SORT1 expression in primary human liver tissue, which is the kind of quantitative expression difference the long-range expression models aim to predict. Here, the oracle captured the direction and the regulatory mechanism, but the predicted effect falls far short of the measured biological magnitude, and this gap is exactly the kind of thing you would still take to a reporter assay.

---

## Variant prioritisation: a worked example

Genome-wide association studies (GWAS) often identify a region of the genome rather than a single causal mutation, because nearby variants are inherited together through **linkage disequilibrium (LD)**. Statistical fine-mapping assigns probabilities to those correlated variants, producing a **credible set**: a small group of candidates that together are likely to contain the true causal variant. Functional prediction can then help rank the variants within that set according to which are most likely to alter gene regulation.

This is exactly the problem addressed in our second worked example. Given a GWAS hit sitting in tight linkage with many neighbours, which variant is actually causal?

A useful anchor here is a recent preprint, [Borzoi-informed fine mapping](https://www.biorxiv.org/content/10.1101/2025.07.09.663936v1) (the "Sniff" framework), which feeds Borzoi variant-effect predictions into Bayesian fine-mapping with PolyFun and SuSiE. For a sub-significant FEV1/FVC ratio association, Sniff resolves the locus — which neither SuSiE nor PolyFun-Baseline could resolve — to a single variant, **rs9504151** (posterior inclusion probability 0.51), and nominates **CDYL** as the likely target gene. Reading Borzoi's attributions, the authors find that the variant disrupts a putative **ATF4** binding motif, with decreased predicted chromatin accessibility and H3K27ac, and the effect localised to **lung fibroblasts**.

We used this locus to ask a different question: driving several oracles by conversation, would Chorus land on the same variant and the same factor? What follows is the team's own re-analysis with Chorus, reported as a demonstration of the prioritisation workflow, not as a result taken from the preprint.

### Step 1, initial scoring with AlphaGenome

> **Prompt:** Fine-map the rs9504151 credible set with AlphaGenome. Which variant ranks first?

rs9504151 sits in a tightly correlated LD block: a Chorus LDlink query (r² ≥ 0.8, 1000G CEU) returned 54 SNV proxies, many of them are in near-perfect LD (r² ≈ 1.0) with the lead, so LD alone cannot distinguish the causal candidate. For the analysis below, Chorus scored the full 56-variant credible set — the lead variant, all linked SNVs, and the few associated indels not counted among the SNVs. This is exactly the kind of locus the Sniff framework is designed to resolve.

We asked Chorus to score this credible set with AlphaGenome. In our run it ranked rs9504151 at the top, predicting that it sits in an active cis-regulatory element in lung fibroblasts whose accessibility and active histone marks drop on the alternate allele. Its RNA tracks predicted no significant expression change at the locus. On that basis Chorus flagged the variant for functional follow-up.

![AlphaGenome fine-mapping of the rs9504151 credible set.](./fig_rs9504151_finemap.png "Figure 5. AlphaGenome fine-maps the 56-variant credible set around rs9504151. rs9504151 ranks #1 by composite functional score; the high-LD neighbour rs62384944 (r²≈0.93) — which raw LD cannot separate from the lead — is demoted to rank 4. Functional prediction resolves what LD alone cannot.")

### Step 2, cross-checking with other oracles, and an honest cell-type caveat

> **Prompt:** Re-score the credible set with a ChromBPNet lung-fibroblast (IMR-90) DNase model and LegNet model trained on HepG2 cell-line. Does rs9504151 stay #1?

This is where having several oracles helps, and also where a real limitation surfaces. We re-scored the set of variants with a LegNet MPRA oracle trained on HepG2 cell line and with a ChromBPNet model trained on lung-fibroblast DNase (IMR-90). In our run, rs9504151 stayed at rank 1 with ChromBPNet on the lung-fibroblast model, and it also ranked second under the HepG2-trained LegNet model.

However, the caveat is important. Only the ChromBPNet model here was matched to the relevant cell type, lung fibroblast. The MPRA reporter panels available to LegNet do not include a lung fibroblast (the available lines are K562, HepG2, and WTC11), so that line of evidence is cell-type-mismatched and should be weighted accordingly. This is particularly relevant for the HepG2-trained LegNet signal, which reflects regulatory activity in a liver cancer context rather than lung fibroblasts. 

You can only assess a variant in the cell types and assays your models actually cover, which is the central limitation of this entire approach, and one the Sniff authors stress as well: if the trait-relevant cell type is missing from a model's training data, the effect can be missed entirely.

### Step 3, identifying the disrupted factor

> **Prompt:** Which TF motif does rs9504151 disrupt? Scan AlphaGenome's TF tracks and run saturation mutagenesis.

Which factor is disrupted could not be read straight off lung-fibroblast TF ChIP-seq data, because such tracks are sparse. So we used two indirect routes: scoring rs9504151 against all of AlphaGenome's ChIP-seq TF tracks (ATF4 and CEBPB came out at the top, with binding *lost* on the alternate allele), and in-silico saturation mutagenesis (Chorus's `score_ism`), which converged on an ATF4-family motif.

Both routes point to ATF4, matching the Sniff preprint's conclusion. The value is not the single answer but that it held up across models trained on different assays, even while the cell-type coverage stayed imperfect.

![In-silico saturation mutagenesis around rs9504151 in three oracles.](./fig_rs9504151_ism.png "Figure 6. In-silico saturation mutagenesis (score_ism) around rs9504151 in three independent oracles — LegNet (HepG2), AlphaGenome (lung fibroblast), and ChromBPNet (IMR-90). Each letter's height is how much mutating that reference base changes the prediction; all three converge on the same ATF4 motif (TGATGCAA) centred on the variant (dashed line).")

---

## Why this helps

- **No pipeline overhead.** Dependency isolation and environment management are handled automatically, so researchers can focus on biology, not infrastructure.
- **Multi-model cross-validation.** Running a variant through ChromBPNet, Enformer, AlphaGenome, and LegNet takes a single prompt, making convergent evidence easy to obtain — keeping in mind that convergence means agreement among the oracles that can actually see a given layer, not a blind vote across all of them.
- **Accessible to non-engineers.** Clinicians and scientists can query foundation models without writing a line of code.
- **Reproducible and auditable.** Standardised inputs and outputs, plus interval-tracked edits, make analyses easy to share, review, and build on.
- **Faster hypothesis generation.** Mechanistic stories that once required weeks of wet-lab experiments can be sketched computationally in hours, as a starting point for validation rather than a replacement for it.

---

## Limitations and open questions

Chorus is an orchestration and interpretation layer, not an oracle of truth. A few caveats are worth stating plainly:

- **Magnitude is unreliable.** As the *SORT1* example shows, the models recover direction and mechanism far better than effect size. Treat predicted fold changes as ordinal, not quantitative.
- **You can only test what the models cover.** A variant can be assessed only in the cell types and assays present in the oracles. In the rs9504151 example the matched evidence came from a lung-fibroblast accessibility model, while the MPRA support came from non-matching lines, so it counts for less. Missing the relevant cell type can mean missing the effect entirely. This is the single most important limitation to keep in mind.
- **Distal targets need long context.** Linking a variant to a gene requires an oracle whose window spans both. Short-range models such as ChromBPNet and LegNet cannot answer gene-level questions, by design rather than by failure, as the 100 kb gap to *SORT1* illustrates. However, even when a model's window does span the target, long-range predictions should be treated with healthy skepticism: current seq2func models still [struggle with distal perturbations](https://genomicsxai.github.io/blogs/2026-007/), and distal eQTLs remain challenging to recover accurately.
- **Single-oracle layers need care.** When only one model scores a layer, that layer is a hypothesis, not a consensus. Convergence across the oracles that can see it is what earns confidence.
- **LD is not always resolvable in silico.** Functional prediction narrows a credible set, but very high LD with parallel signatures can still leave residual ambiguity, and MPRA or other assays remain the arbiter.
- **Predictions are a starting point.** The right mental model is design, then score, then validate, not score then conclude.

Open directions we are interested in: calibrating predicted effect sizes against measured ones, learning when oracles disagree for informative reasons rather than noise, and tightening the agent's track-selection so the conversational path matches an expert's by default.

---

## Try it yourself

Chorus is on GitHub at [github.com/pinellolab/chorus](https://github.com/pinellolab/chorus) under an MIT license. Here is the short path from clone to conversation.

### Install

```bash
# 1. Clone and create the base environment
git clone https://github.com/pinellolab/chorus.git
cd chorus
mamba env create -f environment.yml
mamba activate chorus
python -m pip install -e .

# 2. Set up the oracles you need, each in its own isolated env
chorus setup --oracle alphagenome   # JAX, recommended primary oracle
chorus setup --oracle chrombpnet    # TensorFlow (includes BPNet)
chorus setup --oracle legnet        # PyTorch (MPRA)

# 3. Grab a reference genome and check health
chorus genome download hg38
chorus health --timeout 300
```

The per-oracle commands above install only what you need for these examples. If you would rather grab everything in one shot, a bare `chorus setup` (no flags) builds all seven oracle environments, downloads their weights and backgrounds, and pulls hg38 in a single unattended run.

> AlphaGenome weights live in a gated HuggingFace repository. Accept the license at the `google/alphagenome-all-folds` model page, then `export HF_TOKEN="hf_..."` before first use. The `fine_map_causal_variant` tool additionally needs a free `LDLINK_TOKEN` (or you can pass LD variants manually).

To drive Chorus conversationally — the way both worked examples above were run — connect the MCP server from any project folder:

```bash
curl -sL https://raw.githubusercontent.com/pinellolab/chorus/main/.mcp.json -o .mcp.json
claude   # Claude Code reads .mcp.json on startup and launches the server
```

The same `.mcp.json` block works in Claude Desktop. Three example notebooks in the repo (`single_oracle_quickstart`, `comprehensive_oracle_showcase`, `advanced_multi_oracle_analysis`) cover the Python side from first prediction to cross-oracle comparison.

### A minimal variant-effect call in Python

This scores the *local* effect of the SORT1 variant, the chromatin question from Step 1. Note the explicit window equal to ChromBPNet's input size (2,114 bp) centered on the variant — scoring fixed-input oracles on their full input window is what yields the calibrated effect:

```python
import chorus
from chorus.utils import get_genome

genome = get_genome("hg38")  # auto-downloads if needed
oracle = chorus.create_oracle("chrombpnet", use_environment=True,
                              reference_fasta=str(genome))
oracle.load_pretrained_model(assay="DNASE", cell_type="HepG2")

# rs12740374 (chr1:109274968 G>T): local accessibility effect in liver,
# scored on ChromBPNet's full 2,114 bp input window centered on the variant.
variant_effects = oracle.predict_variant_effect(
    "chr1:109273911-109276025",   # variant ± 1057 bp = 2114 bp
    "chr1:109274968",             # variant position
    ["G", "T"],                   # reference allele first, then alternate
    None,                         # score the loaded track
)
```

The gene-level question (does *SORT1* itself move?) is different: the promoter is about 100 kb away, so it needs a model whose window reaches that far. The cleanest way to ask it is conversationally, letting the agent load AlphaGenome and center its 1 Mb window on the variant.

---

## References

1. Musunuru, K. et al. From noncoding variant to phenotype via SORT1 at the 1p13 cholesterol locus. *Nature* **466**, 714 (2010). <https://doi.org/10.1038/nature09266>
2. Avsec, Ž. et al. Effective gene expression prediction from sequence by integrating long-range interactions (Enformer). *Nature Methods* **18** (2021). <https://www.nature.com/articles/s41592-021-01252-x>
3. Avsec, Ž. et al. Advancing regulatory variant effect prediction with AlphaGenome. *Nature* **649** (2026). <https://www.nature.com/articles/s41586-025-10014-0>
4. Linder, J., Srivastava, D., Yuan, H. et al. Predicting RNA-seq coverage from DNA sequence as a unifying model of gene regulation. Nat Genet 57, 949–961 (2025). https://doi.org/10.1038/s41588-024-02053-6
5. ChromBPNet / BPNet: base-resolution models of chromatin accessibility and TF binding. <https://github.com/kundajelab/chrombpnet>
6. Chen, K. M. et al. Sei: sequence-based prediction of regulatory effects (2022). <https://github.com/FunctionLab/sei-framework>
7. Penzar, D. et al. LegNet: a fully convolutional network for short regulatory sequences (2023). <https://github.com/autosome-ru/LegNet>
8. Lin, J. et al. EPInformer: scalable and integrative prediction of gene expression from promoter-enhancer sequences with multimodal epigenomic profiles. *Nature Communications* **17**, 3975 (2026). <https://www.nature.com/articles/s41467-026-70535-8>
9. Karollus, A., Mauermeier, T. & Gagneur, J. Current sequence-based models capture gene expression determinants in promoters but mostly ignore distal enhancers. Genome Biol 24, 56 (2023). <https://doi.org/10.1186/s13059-023-02899-9>
10. Borzoi-informed fine mapping improves causal variant prioritization in complex trait GWAS (the "Sniff" framework). *bioRxiv* 2025.07.09.663936 (2025). <https://www.biorxiv.org/content/10.1101/2025.07.09.663936v1>
11. Model Context Protocol specification. <https://modelcontextprotocol.io/>
12. Murphy, A. & Koo, P. K. "Benchmarking seq2func models on distal enhancer effects with CRISPRi screens" *Genomics × AI Blog*, 25 June 2026. <https://genomicsxai.github.io/blogs/2026-007/>
13. Chorus source code. <https://github.com/pinellolab/chorus>


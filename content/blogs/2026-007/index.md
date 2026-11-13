---
post_id: "2026-007"
title: "Benchmarking seq2func models on distal enhancer effects with CRISPRi screens"
image: "crispri_fig1.png"
math: false

authors: ["Alan Murphy","Peter K. Koo"]

authors_display:
  - name: "Alan Murphy"
    affiliation: "Cold Spring Harbor Labs (CSHL)"
    orcid: "0000-0002-2487-8753"
  - name: "Peter K. Koo"
    affiliation: "Cold Spring Harbor Labs (CSHL)"
    orcid: "0000-0001-8722-0038"

editor: "dwgoblue"
submitter_github: "Al-Murphy"

tags: ["genomics","crispri","alphagenome","alphagenome2","borzoi","cerberus","enformer","ntv3","seq2func","benchmarking"]
categories: ["Blog Post"]

scope: ["insights"]
audience: ["technical"]
labs: ["Koo lab"]

status: "accepted"
revision: 6

date_submitted: 2026-05-21
date_accepted: 2026-06-25
date: 2026-06-25

doi: ""
zenodo_url: ""
revision_history:
  - version: 1
    date: 2026-05-21
    notes: "Initial submission"
  - version: 2
    date: 2026-07-15
    notes: "Corrected Enformer CRISPRi readout: the cropped model output was indexed with an input-coordinate bin without subtracting the 320-bin (40,960 bp) crop, so the CAGE readout landed ~41 kb off the TSS on background signal. Fix reads the promoter bin. Updates Enformer's correlations and the four figures containing Enformer; Borzoi, NTv3, and AlphaGenome numbers are unchanged."
  - version: 3
    date: 2026-11-04
    notes: "Updated NTv3 to InstaDeep's revised release (NTv3_tracks_1mb, released with the bioRxiv v2 preprint on 29 October 2026), replacing NTv3_650M_post. Updates NTv3's correlations, the three figures containing NTv3 (Figures 2, 3 and 5), the ensemble result, and NTv3-related text. Also corrects the Methods description of each model's output readout. Enformer, Borzoi and AlphaGenome numbers are unchanged."
  - version: 4
    date: 2026-11-11
    notes: "Added Calico's Cerberus (bioRxiv, 9 October 2026) as a fifth model. Borzoi is now read over the target gene's exons, as NTv3 and AlphaGenome already were and as Calico scores genes, instead of a window on the TSS; this updates Borzoi's correlations. Updates the results table, Figures 2, 3 and 5, the ensemble result, and related text. Enformer, NTv3 and AlphaGenome numbers are unchanged."
  - version: 5
    date: 2026-11-12
    notes: "Added Google DeepMind's AlphaGenome 2 (released 11 November 2026) as a sixth model, queried through the hosted AlphaGenome API. Updates the results table, Figures 2, 3 and 5, the ensemble result, and related text, with a note on its track count and a check of the distal shortfall against enhancer accessibility (K562 DNase-seq and H3K27ac). Retitles the scoring section. Also corrects the Methods description of the AlphaGenome readout, which averages the 3 K562 RNA-Seq tracks matching the gene's strand, not all 5. Enformer, Borzoi, Cerberus, NTv3 and AlphaGenome numbers are unchanged."
  - version: 6
    date: 2026-11-13
    notes: "AlphaGenome 2 is now read from the 5 strand-matched K562 RNA-Seq tracks that were measured in K562, leaving out 3 tracks the model imputes for assays never measured there; revision 5 averaged all 8. Its correlations change by at most 0.01 and the conclusions are unchanged. Updates the results table, Figures 2, 3 and 5, and AlphaGenome 2's numbers in the text. Other models' numbers are unchanged."
---

{{< summary >}}
We benchmark six sequence-to-function genomic deep learning models — [Enformer](https://www.nature.com/articles/s41592-021-01252-x), [Borzoi](https://www.nature.com/articles/s41588-024-02053-6), [Cerberus](https://www.biorxiv.org/content/10.64898/2026.10.02.756377v1), [NTv3](https://www.biorxiv.org/content/10.64898/2025.12.22.695963v2), [AlphaGenome](https://www.nature.com/articles/s41586-025-10014-0), and [AlphaGenome 2](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/alphagenome-2-deciphering-how-cells-read-dna-to-better-understand-disease/alphagenome-2.pdf) — zero-shot on two K562 CRISPRi enhancer-knockdown screens ([Fulco et al., 2019](https://pubmed.ncbi.nlm.nih.gov/31784727/) and [Gasperini et al., 2019](https://pubmed.ncbi.nlm.nih.gov/30612741/)), extending the in-silico CRISPRi setup from [Karollus et al., 2023](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-023-02899-9).

Four things stand out:

* **AlphaGenome 2 leads on the larger screen**, Gasperini et al. (Pearson's r = 0.54, against 0.45 for AlphaGenome, the next best). It is a clear but incremental improvement, holding out to about 100 kb from the TSS, with no gain beyond. On the smaller Fulco et al. screen, AlphaGenome 2 (0.75), Cerberus (0.70) and AlphaGenome (0.67) are statistically tied.
* **Cerberus, Borzoi's successor, doesn't improve on it overall.** It is worse for enhancers near the promoter on the larger screen, and level or slightly better further out.
* **All six models systematically underpredict knockdown magnitude**, and the gap to experimental measurements widens with enhancer-to-TSS distance. AlphaGenome 2 comes closest: on the larger screen its predictions are over 90% of the measured knockdowns on average out to 100 kb from the TSS, but under half beyond that — distal cis-regulatory element (CRE) effects remain difficult to predict.
* **AlphaGenome's RNA-Seq head (with GENCODE-exon aggregation) beats its CAGE head** on the larger screen — which output track you choose matters.

**Code**: [seq2func_crispri_eval](https://github.com/Al-Murphy/seq2func_crispri_eval)
{{< /summary >}}

---

## Motivation

Sequence-to-function (seq2func) models keep getting bigger, longer-context, and more capable. [AlphaGenome](https://www.nature.com/articles/s41586-025-10014-0) set the state of the art, succeeding [Enformer](https://www.nature.com/articles/s41592-021-01252-x) (2021) and [Borzoi](https://www.nature.com/articles/s41588-024-02053-6) (2024), and Google DeepMind has now released its successor, [AlphaGenome 2](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/alphagenome-2-deciphering-how-cells-read-dna-to-better-understand-disease/alphagenome-2.pdf) (November 2026), which conditions its predictions on a chosen cell type or state and is served through an API. Calico has also released Borzoi's successor, [Cerberus](https://www.biorxiv.org/content/10.64898/2026.10.02.756377v1) (2026), which replaces Borzoi's attention layers and U-Net with bidirectional state-space (Mamba-2) blocks and reads 786 kb of sequence. DNA language models like [NTv3](https://www.biorxiv.org/content/10.64898/2025.12.22.695963v2) now compete in the same space by post-training on the same functional genomic tracks.

AlphaGenome was launched as a substantial step forward, with most of its zero-shot evaluation focused on single-nucleotide variant (SNV) effects. Two related weaknesses are especially well-documented for this class of model, both originally demonstrated on Enformer: predicting expression across **personalised genomes** (e.g. [Sasse et al.](https://www.nature.com/articles/s41588-023-01524-6)), and predicting **distal CRE effect magnitudes** (how much knocking down a far-away enhancer changes its target gene's expression). Both involve sequence perturbations the model wasn't directly trained on, and both are where seq2func models historically struggle. Performance on these tasks is what tells us whether a model's apparent advance translates to the questions biologists actually care about.

The personalised genome question is how well a model predicts gene expression for a specific individual from their own genome. It's hard because the variants that distinguish one individual from the reference are sparse and small in effect, easy to lose against the much stronger reference signal a sequence model is trained to predict. [Tu et al., 2026](https://www.biorxiv.org/content/10.64898/2026.02.01.702969v1.full) and [Kashyap et al., 2026](https://www.biorxiv.org/content/10.1101/2025.08.05.668750v3.full) recently revisited it: AlphaGenome improves over Enformer on this task, but still falls well short of useful accuracy. The needle moves, but there's a long way to go.

The distal-CRE magnitude question — much bigger perturbations, disabling a whole regulatory element — has received little attention since [Karollus et al., 2023](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-023-02899-9). They defined an _in-silico_ CRISPRi benchmark on [Fulco 2019](https://pubmed.ncbi.nlm.nih.gov/31784727/) and [Gasperini 2019](https://pubmed.ncbi.nlm.nih.gov/30612741/) and ran it on Enformer and Basenji2, finding both substantially undershoot real enhancer effects. Borzoi, Cerberus, NTv3, AlphaGenome, and AlphaGenome 2 have all followed Enformer, claiming gains from longer contexts and broader predictive tasks — yet none have been evaluated on Karollus's magnitude benchmark.

A related but easier task — enhancer-gene linking — has been tested more widely: in the original Enformer paper (Figure 1a), in AlphaGenome's evaluation on the [ENCODE-rE2G CRISPRi dataset](https://www.biorxiv.org/content/10.1101/2023.11.09.563812v1) (Figure 1b), and in the [DNALONGBENCH](https://www.nature.com/articles/s41467-025-65077-4) benchmark. Linking is binary classification: does enhancer X regulate gene Y? A model succeeds by sorting interacting from non-interacting pairs above some threshold. Magnitude prediction is regression: how much does Y drop when X is disabled? It demands ranked and calibrated effect sizes across a continuous range, committing the model to a quantitative theory of enhancer-promoter regulation rather than a topological one. AlphaGenome leads on linking and notes that even it underestimates the impact of very distal enhancers — but doesn't run the magnitude-prediction benchmark. Nor does AlphaGenome 2, which extends the lead on linking, most of all for distal enhancers.

![Figure 1](enf_ag_crispr_orig_pprs.png "width=900 Figure 1: Enhancer-gene linking performance from the original Enformer and AlphaGenome publications. (a) Adapted from Avsec et al. 2021 (Enformer): enhancer–gene pair classification performance (CRISPRi-validated versus non-validated candidate enhancers), stratified by relative distance, measured by auPRC on two CRISPRi datasets for different methods, models, and contribution scores. (b) Adapted from Avsec et al. 2026 (AlphaGenome): zero-shot enhancer-gene linking performance on the ENCODE-rE2G CRISPRi dataset (auPRC), stratified by enhancer-to-TSS distance.")

We aim to address this. We re-run the Karollus benchmark on AlphaGenome 2, AlphaGenome, Borzoi, Cerberus, and NTv3 — and on Enformer, to anchor against Karollus's original numbers. The result is a measure of progress on distal-CRE prediction across the last five years of seq2func releases, not just a test of AlphaGenome's generalisation abilities.

> _Side note:_ CRISPRi (CRISPR interference) uses a catalytically dead Cas9 fused to a repressive domain to silence a target locus without cutting DNA. When the target is a distal enhancer, you can read out which genes go down in expression — giving you a measured enhancer → gene effect size.

> _Side note:_ "seq2func" = sequence-to-function. A model that takes raw DNA as input and predicts functional genomic signals (RNA-seq, CAGE, ATAC, ChIP, etc.) as output. Enformer, Borzoi, Cerberus, AlphaGenome, and AlphaGenome 2 were all trained end-to-end as seq2func models. NTv3 is a hybrid: first pretrained as a genomic language model (gLM) via masked language modeling — predicting hidden bases from their surrounding sequence across many species' genomes — then post-trained on functional assays to produce seq2func outputs.

---

## The benchmark

We test on two K562 CRISPRi enhancer screens:

* **[Fulco et al., 2019](https://pubmed.ncbi.nlm.nih.gov/31784727/)** — ~60 validated enhancer–gene pairs from K562 CRISPRi-FlowFISH. Small but high-confidence.
* **[Gasperini et al., 2019](https://pubmed.ncbi.nlm.nih.gov/30612741/)** — ~440 high-confidence significant pairs from pooled K562 CRISPRi at scale.

For each pair, the procedure is:

1. Build a sequence window of the model's native context (196 kb for Enformer, 524 kb for Borzoi, 786 kb for Cerberus, 1 Mb for NTv3, AlphaGenome, and AlphaGenome 2), centred on the gene's TSS.
2. Score the wild-type window.
3. Dinucleotide-shuffle a 2 kb slice covering the enhancer. Repeat N = 50 times, average the model's prediction.
4. Aggregate the model's K562 output. Enformer has no RNA-Seq output, so it is read from CAGE tracks in a TSS-centred 640 bp window (5 × 128 bp bins). The other five are read from RNA-Seq over the target gene's GENCODE exons — AlphaGenome's preferred RNA-Seq score, and how Calico scores genes with Borzoi and Cerberus. NTv3, AlphaGenome, and AlphaGenome 2 take the mean signal across the exons, averaged over K562 RNA-Seq tracks: all 86 for NTv3, and for the two AlphaGenomes the tracks that match the gene's strand (3 of 5 for AlphaGenome; for AlphaGenome 2, 5 of the 9 tracks measured in K562, leaving out 3 more that the model imputes). Borzoi and Cerberus sum the 32 bp output bins that overlap the exons, on the 71 of their 94 K562 RNA-Seq tracks that match the gene's strand, after converting the output back to coverage with Calico's inverse transform.
5. Score `pred_delta = (WT − mean(shuffle)) / WT` per pair and correlate with the measured fractional knockdown.

> _Side note_: This is a marginalisation procedure — by averaging predictions across many randomised backgrounds in which the enhancer's motif content is destroyed, we isolate the enhancer's contribution from the surrounding sequence context (the same idea underlies Global Importance Analysis (GIA); [Koo et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8118286/)). The background choice matters: N-replacement is out-of-distribution for the model and can produce strange predictions; drawing random bases changes local G+C content, biasing on composition rather than motif loss; even a plain base shuffle destroys dinucleotide frequencies like CpG counts, themselves a learned regulatory signal. Dinucleotide shuffling (Altschul–Erickson) destroys motif content while keeping both single-base and dinucleotide composition intact — the standard background for in-silico CRISPRi.

This protocol is a direct extension of [Karollus 2023](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-023-02899-9) — most of it is bit-for-bit faithful to theirs. We reuse their Fulco et al. evaluation tables (`ziga_additional_columns.tsv` + `enhancer_knockdown_effects.tsv` from their [Zenodo release](https://zenodo.org/records/7613255)) with the same merge keys and validated-pair filtering, their TSS / enhancer / strand conventions, the same Enformer DeepMind checkpoint, and their K562 CAGE readout, central-bin aggregation, and Pearson/Spearman correlation framework. For Gasperini we apply the same protocol to the Cell 2019 high-confidence pairs (after hg19 → hg38 liftover). The model-specific adjustments — per-architecture aggregation conventions like 5×128 bp CAGE bins for Enformer, exon-overlapping 32 bp bins for Borzoi and Cerberus, exon-mean for NTv3 and both AlphaGenomes' RNA-Seq — are architecture-driven; the evaluation harness around them is the Karollus harness. Four deliberate departures from Karollus are flagged in [Limitations](#limitations).

Each model is evaluated using its canonical published inference setup, with no test-time augmentations applied (TTA is explored separately for AlphaGenome below). Inference compute per pair therefore isn't uniform: Borzoi runs four forward passes (one per fold) and Cerberus eight, while the other four run one — we compare models as their authors released them rather than artificially restrict Borzoi and Cerberus to a single fold. Enformer uses the [lucidrains PyTorch port](https://github.com/lucidrains/enformer-pytorch) of the DeepMind weights — same weights as Karollus used, different framework wrapper. Borzoi predictions come from the [Flashzoi](https://huggingface.co/johahi) community PyTorch port, evaluated as the original paper's 4-fold ensemble (predictions averaged across the four published fold checkpoints). Cerberus uses Calico's released PyTorch weights ([baskerville](https://github.com/calico/baskerville/tree/main/releases/cerberus)), evaluated in fp32 as the 8-fold ensemble (predictions averaged across the eight fold checkpoints). AlphaGenome uses the [PyTorch port](https://github.com/genomicsxai/alphagenome-pytorch) loaded with the all-fold distilled checkpoint, a single model trained to reproduce the multi-fold ensemble's behaviour. AlphaGenome 2 isn't released as weights, so we query Google DeepMind's hosted [AlphaGenome API](https://alphagenome.google/api) (Python client 2.0.0, all-folds model), conditioning every request on K562; the hosted model isn't version-pinned, but two full runs on 12 November 2026 returned bit-identical predictions. NTv3 is InstaDeep's revised 1 Mb-context checkpoint, [NTv3_tracks_1mb](https://huggingface.co/InstaDeepAI/NTv3_tracks_1mb), released alongside the v2 preprint (29 October 2026; HF revision a5a644f). As the model expects, its input is soft-masked (repeat bases in lowercase); shuffled enhancer bases keep the reference case at each position.

---

## Results

**AlphaGenome 2 leads on Gasperini et al.; on Fulco et al., AlphaGenome 2, Cerberus and AlphaGenome are tied.** Figure 2 shows predicted vs. measured fractional knockdown for all six models on each screen, with points coloured by enhancer-to-TSS distance.

![Figure 2](crispri_fig1.png "width=900 Figure 2: Predicted vs. measured fractional knockdown for the six models on (a) Fulco et al., 2019 and (b) Gasperini et al., 2019. Points coloured by enhancer-to-TSS distance. On Gasperini, AlphaGenome 2 achieves the highest Pearson and Spearman correlations, followed by AlphaGenome, then Borzoi and Cerberus, with NTv3 and Enformer level behind them. On Fulco, AlphaGenome 2 has the highest Pearson's r and Cerberus the highest Spearman's ρ, within the small-sample noise of each other and of AlphaGenome. The dashed x = y line marks perfect prediction (predicted = observed); points falling below it indicate the model underestimates the experimental knockdown.")

The headline numbers (left two columns: each model on every pair its own receptive field can reach; right two columns: every model restricted to Enformer's 196 kb receptive field, so all six score the same set of pairs):

| Model         | Fulco — full     | Gasperini — full | Fulco — Enformer RF | Gasperini — Enformer RF |
|---------------|-----------------:|-----------------:|--------------------:|------------------------:|
| Enformer      | 0.60 / 0.31      | 0.30 / 0.27      | 0.60 / 0.31         | 0.30 / 0.27             |
| Borzoi        | 0.64 / 0.46      | 0.37 / 0.36      | 0.64 / 0.46         | 0.37 / 0.39             |
| Cerberus      | 0.70 / **0.59**  | 0.34 / 0.31      | 0.70 / **0.58**     | 0.35 / 0.33             |
| NTv3          | 0.51 / 0.27      | 0.29 / 0.29      | 0.51 / 0.26         | 0.31 / 0.30             |
| AlphaGenome   | 0.67 / 0.54      | 0.45 / 0.45      | 0.67 / 0.54         | 0.46 / 0.48             |
| AlphaGenome 2 | **0.75** / 0.50  | **0.54 / 0.52**  | **0.75** / 0.50     | **0.59 / 0.58**         |

Values are Pearson's _r_ / Spearman's ρ. N pairs in the "full" columns varies by model because larger-context models score extra distal pairs that Enformer can't see (Fulco N = 62–63, Gasperini N = 352–438); in the "Enformer RF (Receptive Field)" columns N is uniform (Fulco et al. N = 62, Gasperini et al. N = 352), restricted to the enhancers Enformer predicts.

The matched-RF columns rule out the simple "they just see more sequence" explanation for the leaders: Fulco et al. barely moves (only one distal pair drops), and on Gasperini et al. the rankings are unchanged apart from NTv3 and Enformer, which swap fifth and sixth on Pearson's r (0.29 vs. 0.30, then 0.31 vs. 0.30) — both AlphaGenomes even nudge up (AlphaGenome's Pearson 0.45 → 0.46 and Spearman 0.45 → 0.48; AlphaGenome 2's 0.54 → 0.59 and 0.52 → 0.58).

A few takeaways:

* **AlphaGenome 2 leads on Gasperini et al.**, the larger screen (Pearson's r 0.54, against 0.45 for AlphaGenome and 0.37 for Borzoi). On the same 438 pairs it beats AlphaGenome significantly (Spearman's ρ higher by 0.07, 95% CI 0.02–0.12; Pearson's r higher by 0.09, CI 0.04–0.15; paired bootstrap), a gain about the size of AlphaGenome's own lead over Borzoi. The gain holds out to about 100 kb from the TSS (ρ higher by 0.10, CI 0.01–0.19, n = 180, within 20 kb; by 0.09, CI 0.02–0.16, n = 175, at 20–100 kb) and disappears beyond it (0.00, CI −0.11 to +0.12, n = 83). AlphaGenome in turn leads the rest by a clear margin. On Fulco et al., AlphaGenome 2 (0.75), Cerberus (0.70), AlphaGenome (0.67) and Borzoi (0.64) are essentially tied — AlphaGenome 2's Pearson lead over Borzoi is borderline (r higher by 0.11, CI 0.00–0.26), and on Spearman's ρ all four are level. See the small-sample caveat in [Limitations](#limitations).
* **Context length isn't the explanation.** NTv3 has a 1 Mb context, the same as both AlphaGenomes, but trails them on both screens (matched-RF Pearson's r 0.51 vs. 0.67 and 0.75 on Fulco et al., 0.31 vs. 0.46 and 0.59 on Gasperini et al.). Enformer, despite its shorter 196 kb context (which excludes ~20% of Gasperini et al. pairs), is level with NTv3 on the pairs it can see (Pearson's r 0.30) and not far behind Borzoi (0.37). Nor does Cerberus's longer context (786 kb against 524 kb) lift it above Borzoi on Gasperini et al. (0.34 vs. 0.37).
* **Cerberus is weaker near the promoter, level or better further out.** Against Borzoi, its predecessor, Cerberus ranks Gasperini et al.'s enhancers within 20 kb of the TSS worse (Spearman's ρ lower by 0.14, 95% CI 0.04–0.25, n = 180; paired bootstrap) and is level beyond 20 kb (ρ higher by 0.05, CI −0.04 to +0.14, n = 237). On Fulco et al. it is level within 20 kb and ahead beyond it (ρ higher by 0.29, CI +0.02 to +0.56), though on only 26 pairs. Across all pairs the two are level on both screens.
* **On the same set of pairs, the AlphaGenomes still lead.** Of Gasperini et al.'s pairs, 21 fall within the AlphaGenomes' 1 Mb context but outside Borzoi's 524 kb — so they contribute to the AlphaGenomes' correlations but not Borzoi's (Note, all of the tested Fulco et al. pairs are in Borzoi's context). To make the comparison apples-to-apples, we restrict both to only the pairs Borzoi can also score: AlphaGenome's Pearson's r goes 0.45 → 0.44 and Spearman's ρ stays at 0.45; AlphaGenome 2's stay at 0.54 and 0.52 — giving essentially the same result.
* **The Gasperini et al. ceiling is low across the board.** Even AlphaGenome 2 (Pearson's r 0.54) leaves substantial variance unexplained. Some of this is likely measurement-side: Gasperini et al.'s scaled screen uses a high-MOI single-cell pooled design (median 28 gRNAs per cell), and the statistical and trans-perturbation challenges of high-MOI screens are well-documented ([Barry et al., 2021](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-021-02545-2)). Fulco et al.'s CRISPRi-FlowFISH targets one enhancer at a time with a bulk-population readout, which we'd expect to give more precise per-pair effect sizes. We can't separate measurement noise from model error from these correlations alone, so attributing the gap is interpretive — but it's at least consistent with the per-screen difference we see. Either way, the headline framing is that AlphaGenome and AlphaGenome 2 improve CRISPRi prediction but a large gap remains, especially for distal cis-regulatory elements (CREs).

> _Side note:_ AlphaGenome 2 is trained on the same ENCODE K562 RNA-Seq experiments as AlphaGenome, but keeps paired- and single-ended libraries as separate tracks rather than pooling them, so its score averages 5 strand-matched tracks where AlphaGenome's averages 3. That split isn't what lifts it: using only its paired-ended version of each of AlphaGenome's three tracks (polyA+ and total RNA-Seq on the gene's strand, plus unstranded polyA+), it scores the same on Gasperini et al. (Spearman's ρ 0.52), and four of its five tracks beat AlphaGenome on their own.

### Predictions shrink, knockdowns don't

Figure 3 plots observed and predicted effect against enhancer-to-TSS distance, to more closely match [Karollus et al.'s plotting style](https://link.springer.com/article/10.1186/s13059-023-02899-9/figures/5).

![Figure 3](crispri_fig2.png "width=900 Figure 3: Observed (grey) and predicted (blue) effect (y-axis) vs. enhancer-to-TSS distance (x-axis). Predictions are systematically smaller than observed knockdowns across all six models, and the gap widens at distal distances.")

Two patterns stand out:

* **Predictions are systematically smaller in magnitude than observed knockdowns.** Even where the rank ordering is right (good Spearman), the predicted effect sizes are compressed, most of all for NTv3 and then Cerberus: the lines fitted to their predicted vs. measured effects (Figure 2) have slopes of 0.12–0.13 and 0.17–0.25, against 0.26 or more for the other four. AlphaGenome 2 is the least compressed by far, with slopes of 0.81 and 0.89, against 0.53 and 0.57 for AlphaGenome.
* **The gap grows with distance on Gasperini et al.** There the measured knockdowns barely change with distance, but Enformer's, Borzoi's and AlphaGenome's predictions fall towards zero, so their shortfall grows roughly 1.8- to 2.6-fold from the nearest pairs to the farthest. NTv3 falls short by a similar amount at every distance, because its predictions sit near zero throughout. Cerberus sits in between: it is already further short at the nearest pairs, and its shortfall grows about 1.3-fold. AlphaGenome 2 makes the pattern starkest: out to 100 kb its mean prediction is over 90% of the mean measured knockdown (about 60% for AlphaGenome), but beyond 100 kb it is under half (45%, against 28% for AlphaGenome). On Fulco et al., where the measured effects do decay with distance, the models capture some of that decay but less steeply than the data, most obviously NTv3 and then Cerberus; the two AlphaGenomes are the exception, decaying about as steeply as the data.

**Is the distal shortfall just inaccessible enhancers?** AlphaGenome 2's [preprint](https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/alphagenome-2-deciphering-how-cells-read-dna-to-better-understand-disease/alphagenome-2.pdf) finds that much of the familiar drop in eQTL prediction with distance comes from variants outside accessible chromatin: inside accessible peaks, its sign and effect-size predictions hold up beyond 35 kb of the TSS. That can't explain the shortfall here, because these screens target accessible elements: 98% of Gasperini et al.'s enhancers (94% of Fulco et al.'s) overlap a K562 DNase-seq peak from [ENCODE](https://www.encodeproject.org/experiments/ENCSR000EOT/). Splitting Gasperini et al.'s enhancers at the median DNase signal instead, distance still shrinks the predictions for the more accessible half: beyond 35 kb, AlphaGenome 2's mean prediction is 0.84 of the mean measured knockdown, against 1.19 within 35 kb, while the measured knockdowns don't change (0.32 vs. 0.31). Every model shows the same drop. Accessibility adds a second, separate bias: at every distance, Borzoi, Cerberus and both AlphaGenomes predict larger effects for the more accessible half, although the measured knockdowns of the two halves are about the same size (0.30–0.34). Beyond 35 kb, AlphaGenome 2 predicts under a tenth of the measured effect for 52% of the less accessible enhancers, against 21% of the more accessible ones. Splitting on H3K27ac ([ENCODE](https://www.encodeproject.org/experiments/ENCSR000AKP/)) instead of DNase gives the same picture. So, to summarise, accessibility doesn't explain the distal shortfall: nearly all of these enhancers are accessible, the models underpredict distal effects even for the more accessible half, and, separately, they underpredict the less accessible half at every distance. (Fulco et al. has too few distal pairs to split this way.)

A short aside: AlphaGenome's RNA-Seq head, aggregated as the mean signal across the target gene's GENCODE exons (their paper's preferred approach), beats AlphaGenome's CAGE head (we only compared heads for the original AlphaGenome) on Gasperini et al. (Pearson's r 0.45 vs. 0.39). On Fulco et al. the difference is small (0.67 vs. 0.66). So if you're benchmarking a new model on these screens, your output-aggregation choice should be considered carefully!

![Figure 4](crispri_suppfig2.png "width=900 Figure 4: Predicted vs. measured fractional knockdown for Enformer and AlphaGenome CAGE track and RNA-Seq track on (a) Fulco et al., 2019 and (b) Gasperini et al., 2019. Points coloured by enhancer-to-TSS distance. AlphaGenome's RNA-Seq head with GENCODE-exon aggregation beats its CAGE head on Gasperini et al. and is comparable on Fulco et al. The dashed x = y line marks perfect prediction (predicted = observed); points falling below it indicate the model underestimates the experimental knockdown.")

### Linear vs. log₂ fold-change scoring

A second aside: we computed the predicted effect two ways. Figure 2 used the linear `pred_delta = (WT − mean(shuffle)) / WT`. We also computed log<sub>2</sub>(WT / mean(shuffle)) against −log<sub>2</sub>(1 − y_delta) — a log fold-change scaling that de-emphasises a few high-end outliers. Figure 5 shows the log<sub>2</sub> version. Spearman is identical between the two scorings (rank-invariant); Pearson can shift noticeably, especially on Gasperini, and two pairs narrowly swap order: AlphaGenome and Borzoi on Fulco, and Borzoi and Cerberus on Gasperini — though the broad picture (AlphaGenome 2 first on both screens, and AlphaGenome, Borzoi and Cerberus ahead of NTv3) is robust.

![Figure 5](crispri_suppfig1.png "width=900 Figure 5: Predicted vs. measured knockdown on the log2 alignment scale (log2(WT / mean(shuffle)) vs. −log2(1 − y_delta)) for Borzoi, Cerberus, NTv3, AlphaGenome, and AlphaGenome 2 on (a) Fulco et al., 2019 and (b) Gasperini et al., 2019. Enformer omitted. Points coloured by enhancer-to-TSS distance. Model ranking by Pearson's r matches Figure 2 apart from two narrow swaps: AlphaGenome and Borzoi on Fulco, and Borzoi and Cerberus on Gasperini. Spearman's ρ is identical between the two scorings. The dashed x = y line marks perfect prediction (predicted = observed); points falling below it indicate the model underestimates the experimental knockdown.")

### Test-time augmentation: stabilising AlphaGenome

Karollus et al.'s original benchmark applies **test-time augmentations (TTA)** — for each sequence, run the model on 3 small offsets (−43, 0, +43 bp) crossed with both orientations (forward + reverse-complement), then average the 6 predictions. The 43 bp shift isn't arbitrary: Enformer's output is binned at 128 bp, and 128 / 3 ≈ 43, so the three offsets sample the TSS at roughly even thirds within its bin, averaging out where exactly the landmark falls. Genomic seq2func models have small but real positional sensitivity — predictions wobble across shifts — and TTA reliably damps this. Past work has shown the same effect in adjacent settings ([Toneyan et al., 2022](https://www.nature.com/articles/s42256-022-00570-9)).

> _Side note:_ Test-time augmentation (TTA) means running the model on slightly perturbed versions of the same input and averaging the outputs, so the final prediction is less dependent on incidental properties like exact bin alignment or input orientation.

The headline benchmark (Figures 2–5) doesn't use TTA, so all six models are compared on equal footing. To see what stabilising AlphaGenome's predictions gains on this task, we ran a separate analysis applying Karollus et al.'s 6-pass recipe to AlphaGenome alone. Figure 6 shows the result: TTA improves AlphaGenome's headline correlations on both screens, lifting Pearson's r on Fulco from 0.67 to 0.69 and Spearman on Gasperini from 0.45 to 0.47.

![Figure 6](crispri_suppfig3.png "width=900 Figure 6: AlphaGenome predicted vs. measured fractional knockdown on (a) Fulco et al., 2019 and (b) Gasperini et al., 2019, without test time augmentations (TTA) (middle) versus with 6-pass TTA (3 shifts × 2 orientations, averaged; right). Points coloured by enhancer-to-TSS distance. TTA modestly improves AlphaGenome's correlations on both screens — most visibly Fulco Pearson (0.67 → 0.69) and Gasperini Spearman (0.45 → 0.47); the other metrics are essentially unchanged. Enformer without TTA included for context. The dashed x = y line marks perfect prediction (predicted = observed); points falling below it indicate the model underestimates the experimental knockdown.")

### Does ensembling help?

On the matched-RF (Receptive Field) set used in the headline table, a simple equal-weight average of the six models' predictions doesn't beat the best single model. On Fulco it falls just short of the best single models, AlphaGenome 2 on Pearson's r (0.74 vs. 0.75) and Cerberus on Spearman's ρ (0.57 vs. 0.58), well inside the small-sample noise (see Limitations). On Gasperini, where AlphaGenome 2 dominates, averaging in the weaker models clearly dilutes the predictive signal (Pearson's r 0.52 vs. 0.59; Spearman's ρ 0.54 vs. 0.58). Equal-weight ensembling, in other words, gains nothing over the best single model here.

---

## Limitations

A few things to flag about our analysis.

**Differences from Karollus 2023.** We cross-checked our Enformer reimplementation against Karollus's original code line-by-line with an LLM ([Claude Opus 4.7](https://www.anthropic.com/)). Our Enformer numbers don't exactly match their published ones but the qualitative pattern is the same — Enformer underpredicts distal enhancer effects. Four deliberate departures from their approach may explain some of this gap:

* **Window construction.** Karollus reads precomputed `sequence_start`/`sequence_end` from a fixed table, designed so both TSS and enhancer sit inside Enformer's central crop. We build the window on-the-fly as strict TSS-centred so that all models were compared equally.
* **TTA only for AlphaGenome.** Karollus et al. applies TTA (6 forward passes per sequence) uniformly across all evaluated models. Our headline six-model comparison (Figures 2–5) does not apply TTA to any model — each model is evaluated using its standard published setup: single forward pass for Enformer, NTv3, AlphaGenome (the distilled checkpoint), and AlphaGenome 2 (the all-folds model the API serves), the 4-fold ensemble for Borzoi, and the 8-fold ensemble for Cerberus. We separately apply Karollus et al.'s 6-pass TTA recipe to AlphaGenome (Figure 6) to characterise the stability gain, but we don't apply it to Enformer, Borzoi, Cerberus, NTv3, or AlphaGenome 2.
* **No N-replacement control.** Karollus also runs an all-N enhancer replacement (replacing every base with the "N" wildcard) as a stronger knockout than shuffling. We deliberately don't: while reference genomes do contain N regions (gaps, centromeres, hard-masked repeats), these are typically excluded or under-weighted in training pipelines for these models, so a 2 kb block of N embedded in an otherwise-normal genic context is anomalous input. Predictions there reflect how the model handles unfamiliar input, not how it responds to motif loss, which is the actual question. The dinucleotide shuffle keeps the model in-distribution and isolates the motif-loss signal cleanly.
* **Linear vs. log<sub>2</sub> observed effect.** Karollus uses log<sub>2</sub>(1 + fraction_change); we report the linear fractional change and the log<sub>2</sub> observed effect. Spearman is identical; Pearson's r differs by a small log-vs-linear distortion.

These methodological differences may shift absolute Pearson values, though broad model rankings should be unaffected.

**Small Fulco sample (n ≈ 63).** Fulco et al.'s ~60 validated enhancer–gene pairs is small enough that correlation estimates carry wide confidence intervals — for r ≈ 0.65 at n = 63 the 95% CI spans roughly ±0.15 either side. Numerical differences within roughly ±0.05–0.10 (e.g., AlphaGenome 2 0.75, Cerberus 0.70, AlphaGenome 0.67 and Borzoi 0.64 on Fulco Pearson) should be read as essentially tied, not as a meaningful ordering. Gasperini's ~440 pairs give tighter estimates, so the model gaps there are more reliable.

**K562 only.** Both screens are in K562, and K562 is heavily represented in every model's training data. None of these numbers say anything about how the models would do on cell types under-represented in training. We'd expect the gap between models, and between predictions and truth, to widen there.

**In-silico ≠ real CRISPRi.** Dinucleotide shuffling destroys motif content but doesn't capture chromatin context changes, dCas9 occupancy, or 3D genome reorganisation. It's a motif-loss proxy, not a full simulation. Karollus discusses this; worth keeping in mind when reading the numbers.

**CRISPRi isn't purely cis.** Knocking down an enhancer can affect other nearby genes, or the target gene's own regulatory partners, whose altered expression shifts the cellular context against which we measure the target. Part of any measured enhancer effect is downstream of these indirect (trans) effects, which a sequence-only model predicting from a TSS-centred window can't capture.

---

## Implications

The benchmark tests seq2func models on experimentally validated distal enhancer-promoter interactions. AlphaGenome's gains over Enformer on distal CRE effect-magnitude prediction are substantial, and most pronounced on the larger Gasperini et al. screen. That's real progress. AlphaGenome 2 is a clear but incremental improvement on AlphaGenome: it ranks enhancers better on the larger screen and gets their effect sizes much closer to right, out to about 100 kb from the TSS. Beyond that, it ranks enhancers no better than AlphaGenome and predicts under half their measured effect. But the headline finding — that even AlphaGenome 2 underestimates the magnitude of distal-enhancer effects — converges with what AlphaGenome's own paper observed on the easier enhancer-gene linking task on ENCODE-rE2G: distal CREs remain hard from two distinct evaluation angles. That AlphaGenome 2's gain stops at about 100 kb contrasts with its own preprint, where its advantage on linking is largest beyond 100 kb. Linking a distal enhancer to its gene and predicting how much that gene drops are different problems, and the second is still open. Fully benchmarking seq2func models on distal CRE effect magnitudes will require follow-up CRISPRi screens in cell lines beyond K562 — without them, we can't tell which gains generalise.

Echoing [Tu et al., 2026](https://www.biorxiv.org/content/10.64898/2026.02.01.702969v1.full) and [Kashyap et al., 2026](https://www.biorxiv.org/content/10.1101/2025.08.05.668750v3.full) from a different angle: AlphaGenome and AlphaGenome 2 improve CRISPRi effect prediction, but the remaining gap — especially for distal CREs — is still an open problem for the field.

The repo is set up so adding another model is one new `scripts/test_<dataset>_<newmodel>.py` writing a CSV with `y_delta` and `pred_delta` columns. If you've got a model you want to test, we'd love to see it!

---

## Code and links

* [Source code & evaluation scripts](https://github.com/Al-Murphy/seq2func_crispri_eval)
* [Karollus et al., 2023 — the benchmark this extends](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-023-02899-9)
* [SequenceModelBenchmark Zenodo (Karollus tables)](https://zenodo.org/records/7613255)
* Models: [Enformer (PyTorch)](https://github.com/lucidrains/enformer-pytorch) · [Borzoi](https://github.com/calico/borzoi) (original) · [Flashzoi](https://huggingface.co/johahi) (Borzoi PyTorch port, 4-fold ensemble — used here) · [Cerberus](https://github.com/calico/baskerville/tree/main/releases/cerberus) (Calico, 8-fold ensemble — used here) · [NTv3](https://huggingface.co/InstaDeepAI/NTv3_tracks_1mb) (gated: request access on Hugging Face) · [AlphaGenome PyTorch port](https://github.com/genomicsxai/alphagenome-pytorch) · [AlphaGenome API](https://alphagenome.google/api) (AlphaGenome 2, hosted; needs an API key)

---

## References

1. Avsec, Ž. et al. Effective gene expression prediction from sequence by integrating long-range interactions. _Nature Methods_, 18, 1196–1203 (2021). https://doi.org/10.1038/s41592-021-01252-x
2. Linder, J. et al. Predicting RNA-seq coverage from DNA sequence as a unifying model of gene regulation. _Nature Genetics_, 57, 949–961 (2025). https://doi.org/10.1038/s41588-024-02053-6
3. Kelley, D.R., Yuan, H., Huang, X., Linder, J. Cerberus: bidirectional state space blocks improve accuracy and efficiency of regulatory sequence models. _bioRxiv_ (2026). https://doi.org/10.64898/2026.10.02.756377
4. Boshar, S. et al. A multispecies foundation model for genome function prediction, gene annotation and sequence design. _bioRxiv_ (2026). https://doi.org/10.64898/2025.12.22.695963
5. Avsec, Ž. et al. Advancing regulatory variant effect prediction with AlphaGenome. _Nature_, 649, 1206–1218 (2026). https://doi.org/10.1038/s41586-025-10014-0
6. Gayoso, A., Mottram, A., Karollus, A. et al. AlphaGenome 2 predicts regulatory activity and variant effects across cell states. _Google DeepMind preprint_ (2026). https://storage.googleapis.com/deepmind-media/DeepMind.com/Blog/alphagenome-2-deciphering-how-cells-read-dna-to-better-understand-disease/alphagenome-2.pdf
7. Karollus, A., Mauermeier, T., Gagneur, J. Current sequence-based models capture gene expression determinants in promoters but mostly ignore distal enhancers. _Genome Biology_, 24, 56 (2023). https://doi.org/10.1186/s13059-023-02899-9
8. Fulco, C. P. et al. Activity-by-contact model of enhancer–promoter regulation from thousands of CRISPR perturbations. _Nature Genetics_, 51, 1664–1669 (2019). https://doi.org/10.1038/s41588-019-0538-0
9. Gasperini, M. et al. A genome-wide framework for mapping gene regulation via cellular genetic screens. _Cell_, 176, 377–390.e19 (2019). https://doi.org/10.1016/j.cell.2018.11.029
10. Tu, X. et al. A modality gap in personal-genome prediction by sequence-to-function models. _bioRxiv_ (2026). https://doi.org/10.64898/2026.02.01.702969
11. Kashyap, S., Ramakrishnan, A., Shen, L. AlphaGenome enhances personal gene expression prediction but retains key limitations. _bioRxiv_ (2026). https://doi.org/10.1101/2025.08.05.668750
12. Sasse, A., Ng, B., Spiro, A.E. et al. Benchmarking of deep neural networks for predicting personal gene expression from DNA sequence highlights shortcomings. _Nature Genetics_, 55, 2060–2064 (2023). https://doi.org/10.1038/s41588-023-01524-6
13. Koo, P.K., Majdandzic, A., Ploenzke, M., Anand, P., Paul, S.B. Global importance analysis: An interpretability method to quantify importance of genomic features in deep neural networks. _PLoS Computational Biology_, 17(5), e1008925 (2021). https://doi.org/10.1371/journal.pcbi.1008925
14. Toneyan, S., Tang, Z., Koo, P.K. Evaluating deep learning for predicting epigenomic profiles. _Nature Machine Intelligence_, 4, 1088–1100 (2022). https://doi.org/10.1038/s42256-022-00570-9
15. Gschwind, A.R. et al. An encyclopedia of enhancer-gene regulatory interactions in the human genome. _bioRxiv_ (2023). https://doi.org/10.1101/2023.11.09.563812
16. Cheng, W. et al. DNALONGBENCH: a benchmark suite for long-range DNA prediction tasks. _Nature Communications_, 16, 10108 (2025). https://doi.org/10.1038/s41467-025-65077-4
17. Barry, T., Wang, X., Morris, J.A. et al. SCEPTRE improves calibration and sensitivity in single-cell CRISPR screen analysis. _Genome Biology_, 22, 344 (2021). https://doi.org/10.1186/s13059-021-02545-2

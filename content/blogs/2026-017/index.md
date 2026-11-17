---
post_id: "2026-017"
title: "Modeling gene regulation across cellular contexts with deep learning"
format: "pdf"
pdf: "paper.pdf"

authors: ["Alan E. Murphy", "Ekin D. Aksu", "Selin Jessa", "Ruchir Rastogi", "Wunna Kyaw", "Emily Wong", "Maria Brbić", "Anshul Kundaje", "Peter K. Koo"]

authors_display:
  - name: "Alan E. Murphy"
    affiliation: "Simons Center for Quantitative Biology, Cold Spring Harbor Laboratory, Cold Spring Harbor, NY, USA"
    orcid: "0000-0002-2487-8753"
  - name: "Ekin D. Aksu"
    affiliation: "Max Delbrück Center for Molecular Medicine in the Helmholtz Association, Berlin Institute for Medical Systems Biology, Berlin, Germany; Department of Computational Molecular Biology, Max Planck Institute for Molecular Genetics, Berlin, Germany"
    orcid: ""
  - name: "Selin Jessa"
    affiliation: "Department of Genetics, Stanford University, Stanford, CA, USA; Lunenfeld-Tanenbaum Research Institute, Mount Sinai Hospital, Toronto, ON, Canada; Department of Molecular Genetics, University of Toronto, Toronto, ON, Canada"
    orcid: ""
  - name: "Ruchir Rastogi"
    affiliation: "Department of Genetics, Stanford University, Stanford, CA, USA"
    orcid: ""
  - name: "Wunna Kyaw"
    affiliation: "Victor Chang Cardiac Research Institute, Darlinghurst, NSW, Australia"
    orcid: ""
  - name: "Emily Wong"
    affiliation: "Victor Chang Cardiac Research Institute, Darlinghurst, NSW, Australia; School of Biotechnology and Biomolecular Sciences, Faculty of Science, UNSW Sydney, Sydney, Australia"
    orcid: ""
  - name: "Maria Brbić"
    affiliation: "School of Computer and Communication Sciences, EPFL, Lausanne, Switzerland; School of Life Sciences, EPFL, Lausanne, Switzerland; Swiss Institute of Bioinformatics, Lausanne, Switzerland"
    orcid: ""
  - name: "Anshul Kundaje"
    affiliation: "Department of Genetics, Stanford University, Stanford, CA, USA; Department of Computer Science, Stanford University, Stanford, CA, USA"
    orcid: "0000-0003-3084-2287"
  - name: "Peter K. Koo"
    affiliation: "Simons Center for Quantitative Biology, Cold Spring Harbor Laboratory, Cold Spring Harbor, NY, USA"
    orcid: "0000-0001-8722-0038"

editor: "TBD"
submitter_github: "Al-Murphy"

tags: ["genomics", "gene-regulation", "review", "context-seq2func", "seq2func", "single-cell", "interpretability", "ai-agents"]
categories: ["Paper Reviews"]

scope: ["insights", "discussions"]
audience: ["technical"]
labs: ["Koo lab", "Kundaje lab"]

status: "submitted"
revision: 1

date_submitted: 2026-11-17
date_accepted:
date: 2026-11-17

doi: ""
zenodo_url: ""
revision_history:
  - version: 1
    date: 2026-11-17
    notes: "Initial submission"
    doi: ""
    zenodo_url: ""
---

Understanding how cells regulate gene expression is a longstanding goal of biology. Deep learning has advanced this effort through sequence-to-function models that predict functional genomic measurements from DNA and cell state models that learn patterns of coordinated gene expression. Connecting these approaches could help predict how sequence effects depend on the cellular environment and how regulatory sequence shapes responses to regulator perturbations. Here, we review emerging approaches to joint modeling and examine how biological measurements, model design, and training data shape the regulatory relationships they can learn. We discuss evaluations that test generalization to unmeasured sequences and cellular conditions, alongside interpretation methods that generate mechanistic hypotheses. We then consider how incorporating cellular dynamics could help predict the propagation and persistence of regulatory responses. Finally, we discuss how pilot scaling studies could guide data acquisition and how AI agents could support model development, interpretation, and experimental design.

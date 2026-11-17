#!/usr/bin/env bash
# Validate blog posts in content/blogs/*/index.md
# Fails CI if common mistakes would break rendering or cause odd layout.
# See docs/blog-post-template.md and BLOG_SPEC.md for required fields.

set -e
ERR=0

# Google Scholar ignores PDFs larger than this; render-post-pdfs.sh and
# validate-scholar-metadata.rb use the same limit.
MAX_PDF_BYTES=5000000

# Value of a top-level frontmatter key, without quotes ("" when absent). Reads
# only the frontmatter, so a matching line in the post body never counts.
fm_value() {
  awk -v key="$1" '
    NR == 1 && /^---[[:space:]]*$/ { inside = 1; next }
    inside && /^---[[:space:]]*$/ { exit }
    inside && $0 ~ ("^" key "[[:space:]]*:") {
      sub("^" key "[[:space:]]*:[[:space:]]*", "")
      sub("[[:space:]]+#.*$", "")
      print
      exit
    }' "$2" | sed -e "s/^[\"']//" -e "s/[\"'][[:space:]]*\$//"
}

# Everything after the frontmatter's closing ---.
post_body() {
  awk 'NR == 1 && /^---[[:space:]]*$/ { inside = 1; next }
       inside && /^---[[:space:]]*$/ { inside = 0; body = 1; next }
       body' "$1"
}

for file in $(find content/blogs -name index.md 2>/dev/null || true); do
  [ -z "$file" ] && continue
  echo "Checking $file..."

  # --- 1. File must start with --- (not wrapped in a code block) ---
  first_line=$(head -1 "$file" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [[ "$first_line" =~ ^\`\`\` ]]; then
    echo "::error file=$file::Blog must start with '---'. Remove the opening '\`\`\`markdown' so the file is not inside a code block."
    ERR=1
  fi
  if [[ "$first_line" != "---" ]]; then
    echo "::error file=$file::First line must be '---' (YAML frontmatter). Got: $first_line"
    ERR=1
  fi

  # Frontmatter must be closed with a second ---
  if [ "$(grep -c '^---$' "$file" 2>/dev/null || true)" -lt 2 ]; then
    echo "::error file=$file::Frontmatter must be closed with a second '---' on its own line."
    ERR=1
  fi

  # --- 2. Required frontmatter keys (must appear as key: in the file) ---
  for key in post_id title authors editor tags categories status date_submitted revision_history scope labs; do
    if ! grep -qE "^${key}\s*:" "$file"; then
      echo "::error file=$file::Missing required frontmatter: $key"
      ERR=1
    fi
  done

  # --- 3. date: must be set and look like a real date (avoid citation year 0001) ---
  if grep -qE "^date\s*:" "$file"; then
    date_line=$(grep -E "^date\s*:" "$file" | head -1)
    date_val=$(echo "$date_line" | sed 's/^date\s*:\s*//;s/^["'\'']//;s/["'\'']\s*$//;s/\s*$//')
    if [[ -z "$date_val" ]]; then
      echo "::error file=$file::Frontmatter 'date:' must not be empty (use e.g. date: 2026-02-20)."
      ERR=1
    elif [[ "$date_val" =~ ^[0-9]{1,3}$ ]]; then
      echo "::error file=$file::Frontmatter 'date:' must be a full date (e.g. 2026-02-20), not just a year."
      ERR=1
    fi
  else
    echo "::error file=$file::Missing frontmatter 'date:' (required for citation)."
    ERR=1
  fi

  # --- 4. Wrong image width syntax: ") {width=" or "){width=" (unsupported) ---
  if grep -qE '\)\s*\{\s*width\s*=' "$file"; then
    echo "::error file=$file::Use image title for width: ![](img.png \"width=400\"), not \"){width=400}\"."
    ERR=1
  fi

  # --- 5. title: must have a non-empty value ---
  if grep -qE "^title\s*:\s*[\"']?\s*[\"']?\s*$" "$file"; then
    echo "::error file=$file::Frontmatter 'title:' must not be empty."
    ERR=1
  fi

  # --- 6. Post format: a written post (the default) or a PDF post ---
  # A PDF post sets format: "pdf" and pdf: "<file>.pdf". Its body is the
  # paper's abstract, and the PDF is what readers, Google Scholar and Zenodo
  # get instead of a printout of the page (docs/BLOG_SPEC.md, "Post formats").
  dir=$(dirname "$file")
  format=$(fm_value format "$file")
  pdf=$(fm_value pdf "$file")
  post_id=$(fm_value post_id "$file")
  case "$format" in
    ""|markdown)
      if [ -n "$pdf" ]; then
        echo "::error file=$file::'pdf:' is only used by PDF posts. Add format: \"pdf\" to publish the PDF as the post, or remove 'pdf:'."
        ERR=1
      fi
      ;;
    pdf)
      pdf_file="$dir/$pdf"
      if [ -z "$pdf" ]; then
        echo "::error file=$file::PDF posts need 'pdf:' naming the PDF in the post's folder, e.g. pdf: \"paper.pdf\"."
        ERR=1
      elif ! [[ "$pdf" =~ ^[A-Za-z0-9._-]+\.pdf$ ]]; then
        echo "::error file=$file::'pdf: $pdf' must be a file name in the post's folder ending in .pdf, using only letters, digits, '.', '_' and '-' (e.g. paper.pdf)."
        ERR=1
      elif [ "$pdf" = "$post_id.pdf" ]; then
        echo "::error file=$file::'pdf: $pdf' is reserved for the PDF the deploy prints of written posts. Rename the file, e.g. to paper.pdf."
        ERR=1
      elif [ ! -f "$pdf_file" ]; then
        echo "::error file=$file::'pdf: $pdf' was not found. Add the PDF to $dir/."
        ERR=1
      elif [ "$(head -c 5 "$pdf_file")" != "%PDF-" ]; then
        echo "::error file=$pdf_file::$pdf is not a PDF file."
        ERR=1
      else
        bytes=$(wc -c < "$pdf_file" | tr -d '[:space:]')
        if [ "$bytes" -gt "$MAX_PDF_BYTES" ]; then
          echo "::error file=$pdf_file::$pdf is $((bytes / 1000)) kB. Google Scholar ignores PDFs over 5 MB, so a PDF post must stay under that. Re-export the figures at a lower resolution, or compress it with: gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook -o smaller.pdf $pdf"
          ERR=1
        fi
        # Best effort: names inside compressed object streams are not visible.
        if LC_ALL=C grep -aqE '/(JavaScript|JS|Launch)[^A-Za-z]' "$pdf_file"; then
          echo "::warning file=$pdf_file::$pdf contains embedded JavaScript or a launch action. Editors: ask the author why before merging."
        fi
      fi
      if ! post_body "$file" | grep -q '[^[:space:]]'; then
        echo "::error file=$file::A PDF post's body must be the paper's abstract, below the closing '---' of the frontmatter."
        ERR=1
      fi
      ;;
    *)
      echo "::error file=$file::'format: $format' is not supported. Use format: \"pdf\" for a PDF post, or leave it out for a written post."
      ERR=1
      ;;
  esac
done

if [ $ERR -eq 1 ]; then
  echo ""
  echo "Fix the errors above. See docs/blog-post-template.md and /submission-guidelines/."
  exit 1
fi
echo "Blog validation passed."

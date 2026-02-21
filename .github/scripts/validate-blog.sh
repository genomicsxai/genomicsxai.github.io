#!/usr/bin/env bash
# Validate blog posts in content/blogs/*/index.md
# Fails CI if common mistakes would break rendering or cause odd layout.
# See docs/blog-post-template.md and BLOG_SPEC.md for required fields.

set -e
ERR=0

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
done

if [ $ERR -eq 1 ]; then
  echo ""
  echo "Fix the errors above. See docs/blog-post-template.md and /submission-guidelines/."
  exit 1
fi
echo "Blog validation passed."

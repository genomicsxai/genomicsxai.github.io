#!/usr/bin/env bash
# Print accepted blog posts to PDF so Google Scholar has a full-text file to
# index. Scholar's inclusion guidelines are written around PDFs, and our
# HTML-only posts are often left out.
#
# Builds the site with `hugo --environment pdf` into a temporary directory,
# which adds a print.html beside every post (layouts/blogs/single.print.html),
# serves it on localhost and prints posts with headless Chrome.
#
#   render-post-pdfs.sh
#       Every accepted post, to content/blogs/<dir>/<post_id>.pdf. The site
#       build then publishes the file next to the post and
#       head/scholar-meta.html advertises it via citation_pdf_url. deploy.yml
#       runs this on every deploy; the PDFs are never committed (.gitignore).
#
#   render-post-pdfs.sh --post <post_id> --output <file> [--doi <doi>]
#       One post, showing a DOI that Zenodo has reserved but not yet
#       published. sync-zenodo-dois.rb uses this to put the PDF in the
#       deposit.
#
# A post that fails to print, or prints larger than Scholar's 5 MB limit, is
# skipped with a warning and simply has no PDF. Exits non-zero if any post was
# skipped or nothing could be printed, so a CI step shows the failure, but
# deploy.yml never lets that block a deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MAX_BYTES=5000000

post=""
output=""
doi=""
while [ $# -gt 0 ]; do
  case "$1" in
    --post) post="${2:-}"; shift 2 ;;
    --output) output="${2:-}"; shift 2 ;;
    --doi) doi="${2:-}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
if [ -n "$post" ] && [ -z "$output" ]; then
  echo "--post requires --output" >&2
  exit 2
fi

warn() { echo "::warning::$*" >&2; }

chrome=""
for candidate in "${CHROME_BIN:-}" google-chrome google-chrome-stable chromium chromium-browser \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
  if [ -n "$candidate" ] && command -v "$candidate" >/dev/null 2>&1; then
    chrome="$(command -v "$candidate")"
    break
  fi
done
if [ -z "$chrome" ]; then
  warn "No Chrome or Chromium found (set CHROME_BIN); no PDFs printed."
  exit 1
fi

# "<bundle dir>\t<post_id>" for each accepted post, or for --post only.
posts="$(ruby -ryaml -rdate -e '
  wanted = ARGV.shift.to_s
  ARGV.each do |path|
    match = File.read(path).match(/\A---\s*\n(.*?)\n---\s*\n/m) or next
    fm = YAML.safe_load(match[1], permitted_classes: [Date, Time], aliases: true) || {}
    id = fm["post_id"].to_s
    next if id.empty? || fm["draft"] == true || fm["status"].to_s != "accepted"
    next unless wanted.empty? || wanted == id
    puts "#{File.basename(File.dirname(path))}\t#{id}"
  end' "$post" "$ROOT"/content/blogs/*/index.md)"
if [ -z "$posts" ]; then
  warn "No accepted post${post:+ with post_id $post} to print."
  exit 1
fi

work="$(mktemp -d)"
server_pid=""
cleanup() {
  if [ -n "$server_pid" ]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf "$work"
}
trap cleanup EXIT

# The DOI override is read only by the print template, for this one post.
if [ -n "$post" ]; then
  export HUGO_PARAMS_PDFPOST="$post" HUGO_PARAMS_PDFDOI="$doi"
fi
if ! (cd "$ROOT" && hugo --environment pdf --destination "$work/site" >"$work/hugo.log" 2>&1); then
  cat "$work/hugo.log" >&2
  warn "The print build failed; no PDFs printed."
  exit 1
fi

port="$(python3 -I -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')"
python3 -I -m http.server "$port" --bind 127.0.0.1 --directory "$work/site" >/dev/null 2>&1 &
server_pid=$!
disown "$server_pid"  # no "Terminated" job notice when cleanup stops it
ready=""
for _ in $(seq 1 100); do
  if curl -fs -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null; then ready=1; break; fi
  sleep 0.1
done
if [ -z "$ready" ]; then
  warn "Local server for the print build did not start; no PDFs printed."
  exit 1
fi

timeout_cmd=""
if command -v timeout >/dev/null 2>&1; then timeout_cmd="timeout 180"; fi
sandbox_flag=""
# GitHub's runners cannot start Chrome's sandbox; the pages are our own build.
if [ "${GITHUB_ACTIONS:-}" = "true" ]; then sandbox_flag="--no-sandbox"; fi

failures=0
printed=0
while IFS="$(printf '\t')" read -r dir id; do
  page="http://127.0.0.1:$port/blogs/$dir/print.html"
  tmp="$work/$id.pdf"
  if [ ! -f "$work/site/blogs/$dir/print.html" ]; then
    warn "$id: the print build has no blogs/$dir/print.html; skipped."
    failures=$((failures + 1))
    continue
  fi
  # shellcheck disable=SC2086  # $timeout_cmd and $sandbox_flag are word lists
  if ! $timeout_cmd "$chrome" --headless $sandbox_flag --disable-gpu --hide-scrollbars \
      --no-first-run --no-default-browser-check --user-data-dir="$work/chrome-profile" \
      --no-pdf-header-footer --run-all-compositor-stages-before-draw \
      --virtual-time-budget=20000 --print-to-pdf="$tmp" "$page" >"$work/chrome.log" 2>&1 \
      || [ "$(head -c 5 "$tmp" 2>/dev/null)" != "%PDF-" ]; then
    warn "$id: Chrome could not print $page; skipped. $(tail -n 3 "$work/chrome.log" | tr '\n' ' ')"
    failures=$((failures + 1))
    continue
  fi
  bytes=$(wc -c < "$tmp" | tr -d ' ')
  if [ "$bytes" -gt "$MAX_BYTES" ]; then
    warn "$id: PDF is $bytes bytes, over Google Scholar's 5 MB limit; skipped."
    failures=$((failures + 1))
    continue
  fi
  destination="${output:-$ROOT/content/blogs/$dir/$id.pdf}"
  mv "$tmp" "$destination"
  printed=$((printed + 1))
  echo "Printed $id ($((bytes / 1000)) kB) to ${destination#"$ROOT"/}"
done <<< "$posts"

echo "Printed $printed PDF(s); $failures skipped."
[ "$failures" -eq 0 ] && [ "$printed" -gt 0 ]

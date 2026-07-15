#!/usr/bin/env bash
# Sync the GitHub editors team into data/editors.json, preserving history.
#
# The GitHub Teams API only returns CURRENT members, so this script maintains a
# persistent ledger. Current members are marked active; anyone previously in the
# ledger but no longer on the team is marked as a past editor with an "end" year.
# The deploy workflow restores this ledger from (and persists it back to) the
# dedicated `editors-ledger` branch, since the default branch is protected.
#
# Each ledger entry: { login, name, url, active, start, end }
#   - start: first year the person was seen on the team
#   - end:   year they left (null while active)
#
# IMPORTANT: if no token is available or the API call fails, the existing ledger
# is left untouched — we never overwrite history with an empty list.
#
# Requires: GH_TOKEN with read:org, jq, curl.

set -euo pipefail

ORG="${ORG:-genomicsxai}"
TEAM="${TEAM:-editors}"
OUT="${OUT:-data/editors.json}"
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
YEAR="${EDITORS_YEAR:-$(date -u +%Y)}"

mkdir -p "$(dirname "$OUT")"

# Load the existing ledger; treat missing/invalid as empty.
if [ -f "$OUT" ] && jq -e . "$OUT" >/dev/null 2>&1; then
  LEDGER=$(cat "$OUT")
else
  LEDGER="[]"
fi

if [ -z "$TOKEN" ]; then
  echo "No GH_TOKEN or GITHUB_TOKEN set; leaving existing editor ledger unchanged."
  exit 0
fi

# --- Fetch current team roster (paginated) ---
PAGE=1
ALL=""
while true; do
  RES=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/orgs/${ORG}/teams/${TEAM}/members?per_page=100&page=${PAGE}")
  CODE=$(echo "$RES" | tail -n1)
  BODY=$(echo "$RES" | sed '$d')

  if [ "$CODE" != "200" ]; then
    echo "GitHub API returned $CODE; leaving existing editor ledger unchanged."
    exit 0
  fi

  COUNT=$(echo "$BODY" | jq -r 'length')
  [ "$COUNT" -eq 0 ] && break

  if [ -z "$ALL" ]; then
    ALL="$BODY"
  else
    ALL=$(printf '%s\n%s' "$ALL" "$BODY" | jq -s 'add')
  fi

  [ "$COUNT" -lt 100 ] && break
  PAGE=$((PAGE + 1))
done

[ -z "$ALL" ] && ALL="[]"

# --- Resolve name/url for each current member ---
CURRENT="[]"
for login in $(echo "$ALL" | jq -r '.[].login'); do
  USER=$(curl -s \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/users/${login}")
  NAME=$(echo "$USER" | jq -r '.name // empty')
  URL=$(echo "$USER" | jq -r '.html_url // empty')
  [ -z "$URL" ] && URL="https://github.com/${login}"
  ENTRY=$(jq -nc --arg login "$login" --arg url "$URL" --arg name "$NAME" \
    '{login: $login, url: $url, name: (if $name == "" then null else $name end)}')
  CURRENT=$(echo "$CURRENT" "$ENTRY" | jq -s '.[0] + [.[1]]')
done

# --- Merge current roster into the ledger ---
# Existing entries for current members: refresh name/url, keep start, active=true.
# Existing entries no longer on the team: active=false, stamp end year once.
# Brand-new current members: add with start = this year.
OUT_JSON=$(jq -n \
  --argjson ledger "$LEDGER" \
  --argjson current "$CURRENT" \
  --argjson year "$YEAR" '
  ($current | map({key: .login, value: .}) | from_entries) as $cur
  | ($current | map(.login)) as $curLogins
  | ($ledger | map(
      .login as $l
      | if ($curLogins | index($l)) then
          . + {
            name:   $cur[$l].name,
            url:    $cur[$l].url,
            active: true,
            start:  (.start // $year),
            end:    null
          }
        else
          . + {
            active: false,
            start:  (.start // $year),
            end:    (.end // $year)
          }
        end
    )) as $updated
  | ($updated | map(.login)) as $known
  | $updated
    + ($current
        | map(select(.login as $l | ($known | index($l)) | not))
        | map(. + { active: true, start: $year, end: null }))
  | sort_by([ (if .active then 0 else 1 end),
              ((.name // .login) | ascii_downcase) ])
')

echo "$OUT_JSON" > "$OUT"
ACTIVE=$(echo "$OUT_JSON" | jq '[.[] | select(.active)] | length')
PAST=$(echo "$OUT_JSON" | jq '[.[] | select(.active | not)] | length')
echo "Synced editors ledger into $OUT: ${ACTIVE} active, ${PAST} past."

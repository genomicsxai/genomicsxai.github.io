#!/usr/bin/env bash
# Export blog path -> discussion URL for each discussion in "Post discussions" category.
# Writes data/discussions.json so Hugo can link "Discuss this post" to the right thread.
# Run after ensure-blog-discussions.sh. Requires: GH_TOKEN (or GITHUB_TOKEN), jq, curl.
#
# The discussion `number` is what the giscus embed loads (mapping="number", see
# layouts/_partials/comments/provider/giscus.html). It must come from this
# listing rather than giscus' own pathname lookup, which goes through GitHub's
# discussion search; that index can go stale and then every post's thread
# silently disappears (issue #134).

set -e
OWNER="${OWNER:-genomicsxai}"
REPO="${REPO:-genomicsxai.github.io}"
BASE="${GITHUB_API_URL:-https://api.github.com}"
API="${BASE%/}/graphql"
TOKEN="${GH_TOKEN:-$GITHUB_TOKEN}"
OUT="${1:-data/discussions.json}"

if [ -z "$TOKEN" ]; then
  echo "No GH_TOKEN or GITHUB_TOKEN set; writing empty discussions map."
  mkdir -p "$(dirname "$OUT")"
  echo '{}' > "$OUT"
  exit 0
fi

QUERY='query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
    discussionCategories(first: 20) { nodes { id name } }
  }
}'
RES=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$QUERY" | jq -Rs .), \"variables\": {\"owner\": \"$OWNER\", \"name\": \"$REPO\"}}" "$API")
if ! echo "$RES" | jq -e '.data.repository' >/dev/null 2>&1; then
  echo "GraphQL repo query failed; writing empty discussions map."
  mkdir -p "$(dirname "$OUT")"
  echo '{}' > "$OUT"
  exit 0
fi
REPO_ID=$(echo "$RES" | jq -r '.data.repository.id')
CATEGORY_ID=$(echo "$RES" | jq -r '.data.repository.discussionCategories.nodes[] | select(.name | test("Post [Dd]iscussions"; "i")) | .id' | head -1)
if [ -z "$CATEGORY_ID" ] || [ "$CATEGORY_ID" = "null" ]; then
  echo "Could not find Post discussions category; writing empty discussions map."
  mkdir -p "$(dirname "$OUT")"
  echo '{}' > "$OUT"
  exit 0
fi

# Fetch discussions with url, reaction count (via reactionGroups sum), and comment count (auth required)
Q2='query($owner: String!, $name: String!, $cid: ID!) {
  repository(owner: $owner, name: $name) {
    discussions(first: 100, categoryId: $cid) {
      nodes {
        number
        title
        url
        reactionGroups { reactors(first: 1) { totalCount } }
        comments(first: 1) { totalCount }
      }
    }
  }
}'
RES2=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$Q2" | jq -Rs .), \"variables\": {\"owner\": \"$OWNER\", \"name\": \"$REPO\", \"cid\": \"$CATEGORY_ID\"}}" "$API")
if echo "$RES2" | jq -e '.errors' >/dev/null 2>&1; then
  echo "GraphQL discussions query errors: $(echo "$RES2" | jq -c '.errors')"
fi
NODES=$(echo "$RES2" | jq -c '.data.repository.discussions.nodes // []')
# reactionGroups: sum reactors.totalCount per group; comments: use totalCount.
# If two discussions share a title, the oldest (lowest number) wins:
# from_entries keeps the last entry for a key, so sort newest first.
MAP=$(echo "$NODES" | jq '[sort_by(-.number)[] | {
  key: .title,
  value: {
    number: .number,
    url: .url,
    reactions: ([(.reactionGroups // [])[] | (.reactors.totalCount // 0)] | add // 0),
    comments: (.comments.totalCount // 0)
  }
}] | from_entries')
mkdir -p "$(dirname "$OUT")"
echo "$MAP" > "$OUT"
COUNT=$(echo "$NODES" | jq 'length')
echo "Wrote $COUNT discussion(s) (with counts) to $OUT"
if [ "$COUNT" -gt 0 ]; then
  echo "Sample entry (first discussion): $(echo "$MAP" | jq -c 'to_entries | .[0]')"
fi

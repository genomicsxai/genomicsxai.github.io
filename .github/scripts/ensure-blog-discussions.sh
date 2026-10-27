#!/usr/bin/env bash
# Ensure a GitHub Discussion exists for each blog post (pathname = /blogs/YYYY-NNN/).
# Uses GraphQL: get repo + category ID, list discussions, create missing ones.
# Requires: GH_TOKEN (or GITHUB_TOKEN) with repo scope, jq, curl.
# Usage: run from repo root; set OWNER and REPO or leave default.

set -e
OWNER="${OWNER:-genomicsxai}"
REPO="${REPO:-genomicsxai.github.io}"
BLOGS_DIR="${BLOGS_DIR:-content/blogs}"
# GraphQL endpoint: GITHUB_API_URL in Actions is https://api.github.com (no /graphql)
BASE="${GITHUB_API_URL:-https://api.github.com}"
API="${BASE%/}/graphql"
TOKEN="${GH_TOKEN:-$GITHUB_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "No GH_TOKEN or GITHUB_TOKEN set; skipping ensure-blog-discussions."
  exit 0
fi

# 1) Get repository ID and discussion category ID for "Post discussions"
QUERY='query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
    discussionCategories(first: 20) { nodes { id name } }
  }
}'
RES=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$QUERY" | jq -Rs .), \"variables\": {\"owner\": \"$OWNER\", \"name\": \"$REPO\"}}" "$API")
if ! echo "$RES" | jq -e '.data.repository' >/dev/null 2>&1; then
  echo "GraphQL repo query failed: $RES"
  exit 1
fi
REPO_ID=$(echo "$RES" | jq -r '.data.repository.id')
# Match "Post discussions" or "Post Discussions" (GitHub shows "Post discussions" in the UI)
CATEGORY_ID=$(echo "$RES" | jq -r '.data.repository.discussionCategories.nodes[] | select(.name | test("Post [Dd]iscussions"; "i")) | .id' | head -1)
if [ -z "$CATEGORY_ID" ] || [ "$CATEGORY_ID" = "null" ]; then
  echo "Could not find discussion category 'Post discussions'. Ensure it exists in the repo."
  exit 1
fi

# 2) Collect blog paths: /blogs/YYYY-NNN/
PATHS=()
for dir in "$BLOGS_DIR"/*/; do
  [ -d "$dir" ] || continue
  slug=$(basename "$dir")
  PATHS+=("/blogs/${slug}/")
done
if [ ${#PATHS[@]} -eq 0 ]; then
  echo "No blog posts found under $BLOGS_DIR"
  exit 0
fi

# 3) Fetch existing discussion titles in this category
Q2='query($owner: String!, $name: String!, $cid: ID!) {
  repository(owner: $owner, name: $name) {
    discussions(first: 100, categoryId: $cid) {
      nodes { title }
    }
  }
}'
RES2=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$Q2" | jq -Rs .), \"variables\": {\"owner\": \"$OWNER\", \"name\": \"$REPO\", \"cid\": \"$CATEGORY_ID\"}}" "$API")
EXISTING=$(echo "$RES2" | jq -r '.data.repository.discussions.nodes[].title' | tr '\n' '\n')

# 4) Create discussion for each path that doesn't exist
BASE_URL="https://genomicsxai.github.io"
CREATED=0
for blogpath in "${PATHS[@]}"; do
  # Exact whole-title match (-x). A substring match let preview threads such as
  # "previews/pr-20/blogs/2026-004/" count as the live post's thread, so those
  # posts never got a canonical "/blogs/<slug>/" discussion (issue #134).
  if echo "$EXISTING" | grep -qxF "$blogpath"; then
    continue
  fi
  BODY="Discussion for this blog post. Comments and reactions appear on the site when Giscus is enabled."
  MUTATION='mutation($input: CreateDiscussionInput!) { createDiscussion(input: $input) { discussion { id number url } } }'
  INPUT=$(jq -nc \
    --arg repoId "$REPO_ID" \
    --arg categoryId "$CATEGORY_ID" \
    --arg title "$blogpath" \
    --arg body "$BODY" \
    '{repositoryId: $repoId, categoryId: $categoryId, title: $title, body: $body}')
  RES3=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$MUTATION" | jq -Rs .), \"variables\": {\"input\": $INPUT}}" "$API")
  if echo "$RES3" | jq -e '.data.createDiscussion.discussion' >/dev/null 2>&1; then
    echo "Created discussion for $blogpath"
    CREATED=$((CREATED+1))
  else
    echo "Failed to create discussion for $blogpath: $RES3"
  fi
done
echo "Done. Created $CREATED discussion(s) for blog posts."

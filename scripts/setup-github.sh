#!/usr/bin/env bash
# Configure GitHub repo settings and branch protection for the CI workflow.
# Run once after pushing the repo to GitHub:
#   gh auth login   (if not already authenticated)
#   bash scripts/setup-github.sh <owner/repo>
#
# Requires: gh CLI (https://cli.github.com)

set -euo pipefail

REPO="${1:-}"
if [[ -z "$REPO" ]]; then
  # Try to infer from git remote
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
fi

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo>"
  echo "       or run from inside the cloned repo with a configured remote."
  exit 1
fi

echo "Configuring $REPO..."

# --- Repository settings ---
gh api "repos/$REPO" \
  --method PATCH \
  --field allow_squash_merge=true \
  --field allow_merge_commit=false \
  --field allow_rebase_merge=false \
  --field delete_branch_on_merge=true \
  --field squash_merge_commit_title=PR_TITLE \
  --field squash_merge_commit_message=PR_BODY \
  > /dev/null

echo "  squash-only merge, delete branch on merge"

# --- Branch protection on master ---
gh api "repos/$REPO/branches/master/protection" \
  --method PUT \
  --header "Accept: application/vnd.github+json" \
  --field required_status_checks='{"strict":true,"contexts":["Type check","Lint","Unit tests","Build"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":0,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  > /dev/null

echo "  branch protection: CI required, no force-push, no deletion"
echo ""
echo "Done. CI checks required before merge to master."

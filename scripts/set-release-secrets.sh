#!/usr/bin/env bash
# Uploads the release signing key to the repo's Actions secrets, so the
# Release workflow can sign APKs. Needs `gh auth login` once beforehand.
# Run from Git Bash:  bash scripts/set-release-secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="rayanMELZI/from-now-to-success--mobile"
prop() { grep "^$1=" keystore.properties | cut -d= -f2- | tr -d '\r'; }

[ -f release.keystore ] && [ -f keystore.properties ] || {
  echo "release.keystore / keystore.properties not found in $(pwd)" >&2
  exit 1
}

base64 -w0 release.keystore | gh secret set ANDROID_KEYSTORE_BASE64 -R "$REPO"
prop storePassword | gh secret set ANDROID_STORE_PASSWORD -R "$REPO"
prop keyAlias | gh secret set ANDROID_KEY_ALIAS -R "$REPO"
prop keyPassword | gh secret set ANDROID_KEY_PASSWORD -R "$REPO"
echo "Secrets set. Release with: git tag v1.0.0 && git push origin v1.0.0"

#!/usr/bin/env bash
# Deploys the latest commit to Vercel prod with --force, then verifies
# the three new routes are live. Called manually after `vercel login`
# authenticates the device code.
set -e

cd /home/kiter/orion-passport
echo "=== vercel deploy --prod --force ==="
vercel deploy --prod --force --yes 2>&1 | tail -8

echo "=== waiting 20s for Vercel edge to settle ==="
sleep 20

echo "=== /schemas live? ==="
curl -s -m 25 -A "Mozilla/5.0" -o /tmp/post-schemas.html -w "HTTP %{http_code} | %{size_download} bytes\n" https://passport-orion.vercel.app/schemas
grep -c "EAS schemas" /tmp/post-schemas.html && echo "  ✓ new /schemas content" || echo "  ✗ still old"

echo "=== /register has new action panel? ==="
curl -s -m 25 -A "Mozilla/5.0" -o /tmp/post-register.html -w "HTTP %{http_code} | %{size_download} bytes\n" https://passport-orion.vercel.app/register
grep -c "Issue a receipt" /tmp/post-register.html && echo "  ✓ new action UI" || echo "  ✗ still old"
grep -c "Revoke this passport" /tmp/post-register.html && echo "  ✓ revoke button" || echo "  ✗ missing revoke"

echo "=== /verify has decoder? ==="
curl -s -m 25 -A "Mozilla/5.0" -o /tmp/post-verify.html -w "HTTP %{http_code} | %{size_download} bytes\n" https://passport-orion.vercel.app/verify
grep -c "Trustless verification" /tmp/post-verify.html && echo "  ✓ /verify live" || echo "  ✗ /verify 404"

echo "=== done ==="

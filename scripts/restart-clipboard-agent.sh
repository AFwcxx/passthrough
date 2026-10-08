#!/usr/bin/env bash
set -euo pipefail

service=passthrough-clipboard.service
systemctl --user restart "$service"
systemctl --user status "$service" --no-pager
echo "Clipboard helper restarted. Send a new item to test copying."

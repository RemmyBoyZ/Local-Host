#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=4096" node .next/standalone/server.js
  echo "Server crashed at $(date), restarting in 3 seconds..."
  sleep 3
done

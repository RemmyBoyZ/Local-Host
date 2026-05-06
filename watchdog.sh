#!/bin/bash
while true; do
  cd /home/z/my-project
  node .next/standalone/server.js 2>/dev/null
  sleep 1
done

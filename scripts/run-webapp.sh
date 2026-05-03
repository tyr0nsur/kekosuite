#!/bin/bash
echo "Starting HabboTools Pro WebApp..."
cd /home/surcity-hotel/tools/habbotools-web

# Build if not built yet
if [ ! -d ".next" ]; then
  echo "First run detected, building Next.js application..."
  npm run build
fi

echo "Starting on port 3045..."
npm run start -- -p 3045

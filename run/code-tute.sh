#!/bin/bash

cd /home/sush/Documents/CodeTute-AI/ || {
  echo "Failed to navigate to /home/sush/Documents/CodeTute-AI/"
  exit 1
}

echo "Starting the development server..."
npm run dev &

sleep 5

xdg-open http://localhost:5173/

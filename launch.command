#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
    echo "Node.js is required. Install from https://nodejs.org"
    echo "Press any key to close."
    read -n 1
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

node server.js &
SERVER_PID=$!
sleep 1
open "http://localhost:4000"
wait $SERVER_PID

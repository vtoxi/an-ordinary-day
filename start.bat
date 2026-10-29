@echo off
cd /d "%~dp0"
start "" http://localhost:5173/city.html
npx --yes http-server -p 5173 -c-1 .

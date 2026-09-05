@echo off
title AuraSound IoT - Web Portal Launcher
echo ===================================================
echo     AuraSound IoT: Assistive Hearing System
echo     Starting Local Web Server on Port 5500...
echo ===================================================
cd /d "%~dp0"

echo Opening browser at http://localhost:5500 ...
start http://localhost:5500

python -m http.server 5500 --directory web_portal
pause

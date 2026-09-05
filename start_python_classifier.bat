@echo off
title AuraSound IoT - Python Sound Classifier (Simulation Mode)
echo ===================================================
echo     AuraSound IoT: AI Sound Classifier
echo     Mode: Interactive Simulation
echo ===================================================
cd /d "%~dp0\python_backend"

python sound_classifier.py --mode sim
pause

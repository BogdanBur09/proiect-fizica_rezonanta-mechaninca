@echo off
title Push Proiect Fizica pe GitHub
cd /d "c:\ai stuff\proiect fizica"

echo Adaugam modificarile...
"C:\Program Files\Git\cmd\git.exe" add .

echo Facem commit...
"C:\Program Files\Git\cmd\git.exe" commit -m "Update proiect fizica - %date% %time%" 2>nul

echo Trimitem pe GitHub...
"C:\Program Files\Git\cmd\git.exe" push -u origin main

echo.
echo ==============================================
echo Gata! Proiectul a fost trimis pe GitHub.
echo ==============================================
pause

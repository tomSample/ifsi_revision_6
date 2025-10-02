@echo off
echo ========================================
echo    IFSI Lannion 2025 - Upload Interface
echo ========================================
echo.
echo Demarrage du serveur...
echo.

REM Verifier si Python est installe
python --version >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Python n'est pas installe ou n'est pas dans le PATH
    echo Veuillez installer Python depuis https://python.org
    pause
    exit /b 1
)

REM Installer les dependances si necessaire
echo Installation des dependances...
pip install -r requirements.txt

REM Demarrer le serveur
echo.
echo ========================================
echo Serveur demarre sur http://localhost:5000
echo Appuyez sur Ctrl+C pour arreter
echo ========================================
echo.

python app.py

pause
@echo off
setlocal
echo ══════════════════════════════════════════════════════════
echo   SMART MEAL PLANNER — LOCAL STARTUP SCRIPT
echo ══════════════════════════════════════════════════════════

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found. Please install Python 3.10+
    pause
    exit /b
)

:: Check for Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18+
    pause
    exit /b
)

echo.
echo 🐍 [1/3] SETTING UP BACKEND...
cd backend
if not exist venv (
    echo    - Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
echo    - Installing dependencies...
pip install -r requirements.txt
echo    - Launching FastAPI on http://localhost:8000...
start "SmartMeal Backend" cmd /k "venv\Scripts\activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
cd ..

echo.
echo 🌐 [2/3] SETTING UP NEXT.JS FRONTEND...
cd frontend
if not exist node_modules (
    echo    - Installing npm dependencies...
    npm install
)
echo    - Launching Next.js on http://localhost:3000...
start "SmartMeal Next.js" cmd /k "npm run dev"
cd ..

echo.
echo 📄 [3/3] SERVING VANILLA UI...
echo    - Launching static server on http://localhost:5500...
start "SmartMeal Vanilla UI" cmd /k "python -m http.server 5500"

echo.
echo ══════════════════════════════════════════════════════════
echo   ✅ ALL SERVICES ARE STARTING!
echo.
echo   🔗 Next.js App:    http://localhost:3000
echo   🔗 Vanilla UI:     http://localhost:5500
echo   🔗 Backend API:    http://localhost:8000/docs
echo ══════════════════════════════════════════════════════════
echo.
echo Press any key to exit this script (services will keep running)...
pause >nul

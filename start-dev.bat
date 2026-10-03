@echo off
echo ================================================
echo   🚀 Starting Cloud Language Playground Server
echo ================================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

echo 🔥 Starting development server...
echo.
echo Server will be available at: http://localhost:3000
echo Cron endpoint: http://localhost:3000/api/cron/webhook-retry
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev

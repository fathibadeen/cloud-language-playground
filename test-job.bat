@echo off
setlocal

REM Configuration
set BASE_URL=http://localhost:3000
set JOB_NAME=%1

if "%JOB_NAME%"=="" (
    echo.
    echo ================================================
    echo   🧪 Cron Job Tester - Local Development
    echo ================================================
    echo.
    echo Usage: test-job.bat [job-name]
    echo.
    echo Available jobs:
    echo   - webhook-retry
    echo   - nabrah-reconcile
    echo   - usage-alerts
    echo   - subscription-cycle
    echo   - sla-escalation
    echo   - conversation-janitor
    echo   - retention
    echo.
    echo Example: test-job.bat webhook-retry
    echo.
    exit /b 1
)

echo.
echo ================================================
echo   🔧 Testing Job: %JOB_NAME%
echo ================================================
echo.
echo 📍 URL: %BASE_URL%/api/cron/%JOB_NAME%
echo 🔐 Auth: Bearer test-secret
echo.

REM Make request using curl (if available) or PowerShell
where curl >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo 📡 Sending request with curl...
    echo.
    curl -X POST "%BASE_URL%/api/cron/%JOB_NAME%" ^
         -H "Authorization: Bearer test-secret" ^
         -H "Content-Type: application/json" ^
         -w "\n\n📊 HTTP Status: %%{http_code}\n"
) else (
    echo 📡 Sending request with PowerShell...
    echo.
    powershell -Command "$response = Invoke-WebRequest -Uri '%BASE_URL%/api/cron/%JOB_NAME%' -Method POST -Headers @{'Authorization'='Bearer test-secret'; 'Content-Type'='application/json'} -UseBasicParsing; Write-Host $response.Content; Write-Host ''; Write-Host '📊 HTTP Status:' $response.StatusCode"
)

echo.
echo ================================================
echo   ✅ Test Complete
echo ================================================
echo.

endlocal

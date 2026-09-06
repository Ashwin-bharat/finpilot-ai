@echo off
echo ===================================================
echo   FinPilot AI - Share Localhost:3000 via Cloudflare
echo ===================================================
echo.
echo Starting dev servers (Frontend + Backend) and Cloudflare tunnel...
echo.
start "FinPilot Dev Server" cmd /k "npm run dev"
echo Waiting for servers to initialize...
timeout /t 5 /nobreak >nul
echo Starting Cloudflare Tunnel on http://localhost:3000...
start "FinPilot Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:3000"
echo.
echo Copy the *.trycloudflare.com URL from the tunnel window and send it to your friends!
echo.
pause

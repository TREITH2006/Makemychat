@echo off
setlocal
echo ============================================================
echo   Run this ONCE on your RTX PC (as Administrator) so your
echo   Laptop can connect to LiteLLM (port 4000) over Wi-Fi/LAN
echo ============================================================

docker start litellm-proxy >nul 2>&1
netsh interface portproxy add v4tov4 listenport=4000 listenaddress=0.0.0.0 connectport=4000 connectaddress=127.0.0.1
netsh advfirewall firewall add rule name="LiteLLM Port 4000" dir=in action=allow protocol=TCP localport=4000 >nul 2>&1

echo.
echo [OK] Port 4000 is now open on your RTX PC LAN!
echo Your RTX PC IPv4 Addresses are:
ipconfig | findstr /i "IPv4"
echo.
echo Copy the IPv4 address above into MakeMyChat on your laptop (or click Auto-Find RTX PC).
pause
endlocal

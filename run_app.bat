@echo off
title RankMaster
echo Starting RankMaster Web Server...
echo.
echo NOTE: Ensure you have run 'install_dependencies.bat' at least once!
echo.
call npm run dev
pause
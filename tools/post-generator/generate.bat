@echo off
echo =====================================
echo Stockroom Trading Post Generator Tool
echo =====================================
echo.

IF [%1]==[] (
  echo Please provide a user ID.
  echo Usage: generate.bat USER_ID [COUNT] [COUNTRY]
  exit /b 1
)

set USER_ID=%1
set COUNT=30
set COUNTRY=

IF NOT [%2]==[] set COUNT=%2
IF NOT [%3]==[] set COUNTRY=--country %3

echo Generating %COUNT% posts for user %USER_ID%...
echo.

if NOT [%COUNTRY%]==[] (
  echo Filtering by country: %3
  echo.
)

node generate.js --user %USER_ID% --count %COUNT% %COUNTRY%

echo.
echo =====================================
echo.
pause 
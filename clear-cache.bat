@echo off
echo Clearing Next.js cache and build artifacts...

REM Delete .next folder
if exist .next (
    echo Deleting .next folder...
    rmdir /s /q .next
)

REM Delete node_modules/.cache
if exist node_modules\.cache (
    echo Deleting node_modules/.cache...
    rmdir /s /q node_modules\.cache
)

REM Delete out folder if exists
if exist out (
    echo Deleting out folder...
    rmdir /s /q out
)

echo Cache cleared successfully!
echo Please restart your dev server with: npm run dev
pause

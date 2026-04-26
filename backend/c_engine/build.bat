@echo off
REM ============================================================
REM Build script for the C Grocery Sorting Engine (Windows)
REM Requires: gcc (MinGW) installed and on PATH
REM ============================================================

echo Building grocery_sort.dll ...
gcc -shared -O2 -o grocery_sort.dll grocery_sort.c

if %ERRORLEVEL% EQU 0 (
    echo ✅ Build successful: grocery_sort.dll
) else (
    echo ❌ Build failed. Make sure gcc (MinGW) is installed.
    exit /b 1
)

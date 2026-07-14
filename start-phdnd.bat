@echo off
rem Local preview for the PhDnD site.
rem Double-click this file, keep the black window open while you browse,
rem and close it when you're done.
cd /d "%~dp0"
start "" "http://localhost:8330/session.html"
python -m http.server 8330

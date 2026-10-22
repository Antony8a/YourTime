@echo off
rem Enciende todo lo que YourTime necesita en este PC: Docker, la base de datos y la API.
rem Doble clic. Deja la ventana abierta hasta que diga LISTO.
setlocal
cd /d "%~dp0.."

docker info >nul 2>&1
if errorlevel 1 (
  echo Encendiendo Docker Desktop...
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
)
:esperar
docker info >nul 2>&1
if errorlevel 1 (
  timeout /t 5 /nobreak >nul
  goto esperar
)

echo Encendiendo la base de datos y la API...
docker compose -f infra\docker\docker-compose.yml up -d
if errorlevel 1 (
  echo No pude encender los contenedores.
  pause
  exit /b 1
)

echo Esperando a que la API responda...
set /a intentos=0
:salud
curl -s -f -o nul http://localhost:8080/health
if errorlevel 1 (
  set /a intentos+=1
  if %intentos% geq 30 (
    echo La API no respondio. Mira: docker logs yourtime-backend
    pause
    exit /b 1
  )
  timeout /t 3 /nobreak >nul
  goto salud
)

echo.
echo LISTO. La API esta encendida.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo   Direccion para el celular: http://%%b:8080
)
echo.
pause

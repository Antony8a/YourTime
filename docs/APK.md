# APK local (sin la nube)

Cómo generar un APK de YourTime en este PC y usarlo sin Metro ni cable. La API sigue corriendo en tu
Docker y el celular se conecta a ella por WiFi.

```
Celular (APK)  ──WiFi──▶  Tu PC: API (Docker) ──▶ Postgres (Docker)
```

El APK **no lleva el backend adentro** (Go y Postgres no corren en un celular): necesita que el PC
esté encendido y en la misma red.

## Encender el PC cada día

Doble clic en [`scripts/iniciar-yourtime.bat`](../scripts/iniciar-yourtime.bat). Enciende Docker
Desktop si está apagado, levanta la base de datos y la API, y muestra la dirección para el celular.

Los contenedores tienen `restart: unless-stopped`, así que también vuelven solos cuando Docker
arranca. Para que Docker arranque con Windows: Docker Desktop → _Settings → General → Start Docker
Desktop when you sign in_.

## Generar el APK

Con Docker Desktop encendido, desde la raíz del repositorio:

```powershell
.\scripts\build-apk.ps1
```

- Compila dentro de un contenedor (JDK 17, Node 20 y el Android SDK que pide Expo SDK 52), sin
  instalar nada en Windows. La primera vez descarga varios GB y tarda 20-40 min; las siguientes, mucho
  menos (la caché de Gradle y de pnpm se guarda en volúmenes de Docker).
- Deja el archivo en `dist\YourTime.apk`.
- Usa la IP de WiFi de este PC como servidor por defecto. Para otra: `-ApiUrl http://192.168.1.50:8080`.
- Compila solo para **arm64-v8a** (casi todos los celulares de los últimos años, incluido el Motorola
  Edge 50 Pro). Para otras arquitecturas: `-Abis "arm64-v8a,armeabi-v7a,x86_64"`.

## Instalarlo en el celular

Sin cable, con el celular en el mismo WiFi:

1. En el PC: `npx http-server dist -p 8000` (o cualquier servidor de archivos).
2. En el navegador del celular abre `http://<IP-del-PC>:8000/YourTime.apk`.
3. Permite _Instalar apps desconocidas_ para ese navegador y acepta la instalación.

Con cable: `adb install -r dist\YourTime.apk`.

## Si cambia la IP del PC

No hace falta recompilar: en la pantalla de inicio de sesión toca **Servidor · Cambiar**, escribe la
nueva IP (el puerto 8080 se completa solo) y la app prueba la conexión antes de guardarla. Para que no
cambie, reserva la IP del PC en el router (_reserva DHCP_).

## Detalles

- **HTTP en claro:** el APK permite conectarse por `http://` (Android lo bloquea por defecto en
  compilaciones finales) porque la API local no tiene certificado. Es razonable en tu red; para una API
  en internet, usa `https`.
- **Firma:** el APK se firma con la clave de depuración que genera Expo. Sirve para uso personal y
  para actualizar sobre una instalación anterior mientras uses la misma. No es apta para Google Play.
- **Mapas y rutas** siguen usando los servidores públicos de prueba, así que el celular necesita
  internet además del WiFi del PC (ver `CONTEXTO.md`).
- Si en algún momento quieres la API en internet, [`DESPLIEGUE.md`](DESPLIEGUE.md) explica cómo
  hacerlo gratis con Render y Neon.

# 🔥 Configuración de Firebase para Rally STI 2026

Esta guía te explica cómo conectar la app con Firebase Realtime Database
para que múltiples evaluadores puedan sincronizar puntos en tiempo real.

> **Firebase tiene un plan gratuito (Spark)** que es más que suficiente para un evento de rally.

---

## Paso 1 — Crear el proyecto en Firebase

1. Ve a **[https://console.firebase.google.com](https://console.firebase.google.com)**
2. Haz clic en **"Agregar proyecto"**
3. Ponle un nombre, por ejemplo: `rally-sti-2026`
4. Puedes desactivar Google Analytics (no es necesario)
5. Haz clic en **"Crear proyecto"**

---

## Paso 2 — Crear la Realtime Database

1. En el menú izquierdo, ve a **"Compilación" → "Realtime Database"**
2. Haz clic en **"Crear base de datos"**
3. Selecciona la región más cercana (ej. `us-central1`)
4. Selecciona **"Iniciar en modo de prueba"** ← importante para que funcione sin autenticación
5. Haz clic en **"Habilitar"**

---

## Paso 3 — Obtener la configuración de tu app

1. Ve a **"Configuración del proyecto"** (ícono de engranaje ⚙️ arriba a la izquierda)
2. Baja hasta la sección **"Tus aplicaciones"**
3. Haz clic en el ícono **`</>`** (Web)
4. Escribe un apodo, por ejemplo: `rally-web`
5. **No** actives Firebase Hosting
6. Haz clic en **"Registrar app"**
7. Copia el objeto `firebaseConfig` que aparece, se ve así:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "rally-sti-2026.firebaseapp.com",
  databaseURL: "https://rally-sti-2026-default-rtdb.firebaseio.com",
  projectId: "rally-sti-2026",
  storageBucket: "rally-sti-2026.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Paso 4 — Pegar la configuración en index.html

Abre `index.html` y busca esta sección (alrededor de la línea 115):

```js
const firebaseConfig = {
  apiKey: "REEMPLAZAR_API_KEY",
  authDomain: "REEMPLAZAR.firebaseapp.com",
  databaseURL: "https://REEMPLAZAR-default-rtdb.firebaseio.com",
  ...
};
```

Reemplázala con los valores reales que copiaste en el paso anterior.

---

## Paso 5 — Cambiar el PIN del evaluador

En `index.html`, busca esta línea en la sección `CONFIG`:

```js
evaluatorPin: "sti2026",   // ← Cambia este PIN antes de publicar
```

Cámbiala por el PIN que quieras usar.

---

## Paso 6 — Ajustar las reglas de seguridad (opcional pero recomendado)

Ve a **Realtime Database → Reglas** y usa estas reglas para que solo se pueda leer/escribir:

```json
{
  "rules": {
    "scores": {
      ".read": true,
      ".write": true
    }
  }
}
```

> ⚠️ Estas reglas permiten que cualquiera que tenga la URL de tu BD pueda escribir.
> Como el PIN protege el acceso a la UI, esto es aceptable para un evento temporal.
> Después del evento, cambia las reglas a `".write": false`.

---

## Paso 7 — Subir a GitHub Pages

```bash
git add .
git commit -m "Rally STI 2026 — App estática con Firebase"
git push
```

La app estará disponible en: `https://TU_USUARIO.github.io/`

---

## ✅ Checklist final

- [ ] Proyecto Firebase creado
- [ ] Realtime Database habilitada en modo prueba
- [ ] `firebaseConfig` pegado en `index.html`
- [ ] PIN del evaluador cambiado en `index.html`
- [ ] Probado localmente abriendo `index.html` en el navegador
- [ ] Subido a GitHub

---

## 🆘 Si no puedes configurar Firebase ahora

La app funciona **sin Firebase** usando `localStorage` del navegador.
Los datos se guardan localmente en el dispositivo del evaluador,
pero **no se sincronizan** entre dispositivos.

Simplemente abre `index.html` en el navegador sin configurar Firebase
y podrás usar la app normalmente en un solo dispositivo.

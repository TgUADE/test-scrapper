require("dotenv").config();
const express = require("express");
const fs = require("fs").promises;
const path = require("path");

// Usar puppeteer-extra con plugins GRATUITOS para bypass de reCAPTCHA
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const randomUseragent = require("random-useragent");
const UserAgent = require("user-agents");

const { authenticator } = require("otplib");

const {
  USER_EMAIL,
  USER_PASSWORD,
  TOKEN_CODE,
  API_TOKEN,
  PORT = 3001,
  MAX_ATTEMPTS = 3,
} = process.env;

if (!USER_EMAIL || !USER_PASSWORD || !TOKEN_CODE || !API_TOKEN) {
  console.error(
    "❌ Debes configurar USER_EMAIL, USER_PASSWORD, TOKEN_CODE y API_TOKEN en .env"
  );
  process.exit(1);
}

// Configurar plugins de puppeteer-extra (SOLO GRATUITOS)
puppeteer.use(StealthPlugin());

// Archivo para guardar las cookies
const COOKIES_FILE = path.join(__dirname, "session_cookies.json");

// Función para guardar cookies
async function saveCookies(page) {
  try {
    const cookies = await page.cookies();
    await fs.writeFile(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  } catch (error) {
    console.error("❌ Error guardando cookies:", error.message);
  }
}

// Función para cargar cookies
async function loadCookies(page) {
  try {
    const cookiesData = await fs.readFile(COOKIES_FILE, "utf8");
    const cookies = JSON.parse(cookiesData);

    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Función para verificar si las cookies son válidas
async function verifyCookiesValid(page, authHeaderRef) {
  try {
    // Navegar al dashboard para verificar si estamos logueados
    const dashboardUrl =
      "https://perlastore6.mitiendanube.com/admin/v2/apps/envionube/ar/dashboard";
    console.log(`🔗 Navegando para verificar cookies a: ${dashboardUrl}`);
    await page.goto(dashboardUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Esperar un poco para que se carguen las requests
    await new Promise((r) => setTimeout(r, 3000));

    // Mostrar URL después de la navegación
    const currentUrl = page.url();
    console.log(`🔗 URL después de verificar cookies: ${currentUrl}`);

    // Si se capturó el token durante la navegación, las cookies son válidas
    if (authHeaderRef.value) {
      console.log("✅ Cookies válidas - token capturado durante navegación");
      return true;
    }

    // Verificar si estamos en una página de login o en el dashboard
    console.log(`🔗 URL después de verificar cookies: ${currentUrl}`);

    // Si la URL contiene "login" significa que las cookies no son válidas
    if (currentUrl.includes("login") || currentUrl.includes("signin")) {
      console.log("❌ Cookies inválidas - redirigido a login");
      return false;
    }

    // Verificar si hay contenido del dashboard
    const pageContent = await page.evaluate(() => document.body.innerText);

    // Si el contenido indica que estamos logueados
    if (
      pageContent.includes("Dashboard") ||
      pageContent.includes("Cargando") ||
      !pageContent.includes("Iniciar sesión")
    ) {
      console.log("✅ Cookies válidas - contenido indica sesión activa");
      return true;
    }

    console.log(
      "❌ Cookies inválidas - contenido no corresponde a sesión activa"
    );
    return false;
  } catch (error) {
    console.error("❌ Error verificando cookies:", error.message);
    console.log(`🔗 URL durante error de verificación: ${page.url()}`);
    return false;
  }
}

// Función para eliminar cookies inválidas
async function deleteCookiesFile() {
  try {
    await fs.unlink(COOKIES_FILE);
  } catch (error) {}
}

// Genera el código TOTP
function generateToken() {
  try {
    return authenticator.generate(TOKEN_CODE);
  } catch (err) {
    console.error("❌ Error generando TOTP:", err);
    throw err;
  }
}

async function loginTiendanube(orderId) {
  // Generar user agent aleatorio pero realista
  const userAgent = new UserAgent();
  const randomUA = userAgent.toString();

  // Viewport aleatorio para parecer más humano
  const randomViewport = {
    width: 1920 + Math.floor(Math.random() * 100),
    height: 1080 + Math.floor(Math.random() * 100),
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: false,
    isMobile: false,
  };

  const browserOptions = {
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled", // Crítico para evitar detección
      "--disable-extensions",
      "--disable-plugins",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-hang-monitor",
      "--disable-prompt-on-repost",
      "--disable-sync",
      "--disable-translate",
      "--disable-default-apps",
      "--disable-component-extensions-with-background-pages",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-client-side-phishing-detection",
      "--disable-datasaver-prompt",
      "--disable-domain-reliability",
      "--disable-features=TranslateUI",
      "--mute-audio",
      "--no-default-browser-check",
      "--no-pings",
      "--password-store=basic",
      "--use-mock-keychain",
      // Argumentos adicionales para bypass de detección
      "--disable-automation",
      "--exclude-switches=enable-automation",
      "--disable-extensions-http-throttling",
      "--metrics-recording-only",
      "--no-report-upload",
      "--safebrowsing-disable-auto-update",
    ],
    headless: "shell",
    slowMo: 50 + Math.floor(Math.random() * 50), // Delay aleatorio para parecer humano
    defaultViewport: randomViewport,
    ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"], // Permitir extensiones
    ignoreHTTPSErrors: true,
    timeout: 60000,
    devtools: false,
  };

  console.log(
    "🚀 Intentando lanzar browser con configuración anti-detección..."
  );

  let browser;
  try {
    browser = await puppeteer.launch(browserOptions);
  } catch (launchError) {
    console.error("💥 Error al lanzar el browser:", launchError.message);

    // Intentar con configuración más básica
    console.log("🔄 Intentando con configuración básica...");
    const basicOptions = {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
      headless: "shell",
      slowMo: 0,
      ignoreHTTPSErrors: true,
    };

    try {
      browser = await puppeteer.launch(basicOptions);
    } catch (basicError) {
      console.error("💀 Error crítico: No se pudo lanzar el browser");
      throw new Error(`No se pudo lanzar el browser: ${basicError.message}`);
    }
  }

  try {
    const page = await browser.newPage();

    // Establecer user agent aleatorio
    await page.setUserAgent(randomUA);

    // TÉCNICA 1: Ocultar que es un navegador automatizado
    await page.evaluateOnNewDocument(() => {
      // Pass webdriver check - Eliminar la propiedad webdriver
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Eliminar propiedades de automatización
      delete window.webdriver;
      delete window.__webdriver_evaluate;
      delete window.__selenium_evaluate;
      delete window.__webdriver_script_function;
      delete window.__webdriver_script_func;
      delete window.__webdriver_script_fn;
      delete window.__fxdriver_evaluate;
      delete window.__driver_unwrapped;
      delete window.__webdriver_unwrapped;
      delete window.__driver_evaluate;
      delete window.__selenium_unwrapped;
      delete window.__fxdriver_unwrapped;
    });

    // TÉCNICA 2: Pass chrome check - Agregar propiedades de Chrome
    await page.evaluateOnNewDocument(() => {
      window.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };
    });

    // TÉCNICA 3: Pass notifications check - Sobrescribir permisos
    await page.evaluateOnNewDocument(() => {
      const originalQuery = window.navigator.permissions.query;
      return (window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters));
    });

    // TÉCNICA 4: Pass plugins check - Sobrescribir la propiedad plugins
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    // TÉCNICA 5: Pass languages check - Sobrescribir la propiedad languages
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "languages", {
        get: () => ["es-ES", "es", "en-US", "en"],
      });
    });

    // TÉCNICA 6: Configurar headers HTTP realistas
    await page.setExtraHTTPHeaders({
      "Accept-Language": "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "max-age=0",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-User": "?1",
      "Sec-Fetch-Dest": "document",
    });

    // TÉCNICA 7: Función para detectar y evadir reCAPTCHA
    const solveRecaptchaIfPresent = async () => {
      try {
        console.log("🔍 Verificando presencia de reCAPTCHA...");

        // Buscar diferentes tipos de reCAPTCHA
        const recaptchaSelectors = [
          'iframe[src*="recaptcha"]',
          ".g-recaptcha",
          "#recaptcha",
          "[data-sitekey]",
          ".recaptcha-checkbox",
          ".rc-anchor-container",
          ".rc-imageselect",
          "#recaptcha-anchor",
          ".recaptcha-checkbox-border",
        ];

        let recaptchaFound = false;

        for (const selector of recaptchaSelectors) {
          const element = await page.$(selector);
          if (element) {
            recaptchaFound = true;
            break;
          }
        }

        if (recaptchaFound) {
          await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));

          // TÉCNICA 2: Simular interacciones humanas sutiles
          console.log("🖱️ Simulando interacciones humanas...");

          // Movimientos de mouse aleatorios sobre la página
          for (let i = 0; i < 3; i++) {
            const x = Math.random() * 800;
            const y = Math.random() * 600;
            await page.mouse.move(x, y);
            await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
          }

          // TÉCNICA 3: Intentar hacer click en checkbox si es reCAPTCHA v2
          try {
            const checkboxSelectors = [
              ".recaptcha-checkbox-border",
              ".rc-anchor-checkbox",
              "#recaptcha-anchor",
              ".recaptcha-checkbox",
            ];

            for (const selector of checkboxSelectors) {
              const checkbox = await page.$(selector);
              if (checkbox) {
                console.log(`☑️ Intentando click en checkbox: ${selector}`);

                // Simular hover antes del click
                await page.hover(selector);
                await new Promise((r) =>
                  setTimeout(r, 500 + Math.random() * 500)
                );

                // Click con delay humano
                await page.click(selector);
                await new Promise((r) =>
                  setTimeout(r, 1000 + Math.random() * 1000)
                );

                console.log("✅ Click en checkbox realizado");
                break;
              }
            }
          } catch (err) {
            console.log("⚠️ No se pudo hacer click en checkbox:", err.message);
          }

          console.log("✅ reCAPTCHA procesado");
        } else {
          console.log("✅ No se detectó reCAPTCHA");
        }
      } catch (error) {
        console.log("⚠️ Error al verificar/evadir reCAPTCHA:", error.message);
        // No lanzar error, continuar con el flujo
      }
    };

    let authHeader = null;

    // Crear objeto de referencia para poder pasarlo a funciones
    const authHeaderRef = { value: null };

    // NUEVO: Función para mostrar la URL actual
    const logCurrentUrl = (context = "") => {
      const currentUrl = page.url();
      console.log(`🔗 URL actual ${context}: ${currentUrl}`);
      return currentUrl;
    };

    // NUEVO: Listener para detectar cambios de navegación
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        logCurrentUrl("(navegación detectada)");
      }
    });

    // Captura del header Authorization
    page.on("request", async (req) => {
      const url = req.url();

      // Buscar requests que puedan contener el token de autorización
      if (
        url.includes("/stores/orders") ||
        url.includes("/api/") ||
        url.includes("/admin/") ||
        url.includes("envionube") ||
        url.includes("nuvem-envio-app-back.ms.tiendanube.com")
      ) {
        const authHeaderValue = req.headers().authorization;
        if (authHeaderValue && !authHeader) {
          authHeader = authHeaderValue;
          authHeaderRef.value = authHeaderValue;
          console.log(
            `✅ Header Authorization capturado: ${authHeader.substring(
              0,
              20
            )}...`
          );

          // Guardar cookies actuales
          await saveCookies(page);
        }
      }
    });

    const cookiesLoaded = await loadCookies(page);

    if (cookiesLoaded) {
      const cookiesValid = await verifyCookiesValid(page, authHeaderRef);

      if (cookiesValid) {
        // Verificar reCAPTCHA en el dashboard
        await solveRecaptchaIfPresent();
        logCurrentUrl("después de verificar reCAPTCHA en dashboard");

        let attempts = 0;
        const maxAttempts = 20; // 20 segundos máximo

        while (attempts < maxAttempts && !authHeader) {
          await new Promise((r) => setTimeout(r, 1000));
          attempts++;

          if (authHeader) {
            console.log("✅ Token capturado usando cookies!");
            logCurrentUrl("después de capturar token con cookies");
            break;
          }
        }

        if (!authHeader) {
          console.log(
            "⚠️ No se pudo capturar token con cookies, intentando refresh..."
          );
          logCurrentUrl("antes del refresh");
          await page.reload({ waitUntil: "networkidle2", timeout: 60000 });
          logCurrentUrl("después del refresh");
          await new Promise((r) => setTimeout(r, 3000));

          // Verificar reCAPTCHA después del refresh
          await solveRecaptchaIfPresent();

          // Esperar un poco más después del refresh
          let refreshAttempts = 0;
          const maxRefreshAttempts = 10;

          while (refreshAttempts < maxRefreshAttempts && !authHeader) {
            await new Promise((r) => setTimeout(r, 1000));
            refreshAttempts++;
            console.log(
              `⏳ Refresh intento ${refreshAttempts}/${maxRefreshAttempts} - Token: ${
                authHeader ? "CAPTURADO" : "No capturado"
              }`
            );

            if (authHeader) {
              console.log("✅ Token capturado después del refresh!");
              logCurrentUrl("después de capturar token tras refresh");
              break;
            }
          }
        }
      }

      // Si las cookies no funcionaron
      if (!authHeader) {
        await deleteCookiesFile();
      }
    }

    // 🔑 FLUJO COMPLETO DE LOGIN (solo si las cookies no funcionaron)
    if (!authHeader) {
      console.log("🔑 PASO 1: Navegando a página de login...");
      await page.goto("https://www.tiendanube.com/login", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
      logCurrentUrl("después de navegar a página de login");
      console.log("✅ Página de login cargada");

      // Verificar y resolver reCAPTCHA si está presente
      await solveRecaptchaIfPresent();
      logCurrentUrl("después de verificar reCAPTCHA en login");

      console.log(`📝 Escribiendo email: ${USER_EMAIL}`);
      // Simular comportamiento humano más realista
      await page.hover("#user-mail");
      await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
      await page.click("#user-mail");
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
      await page.type("#user-mail", USER_EMAIL, {
        delay: 50 + Math.random() * 50,
      });
      console.log("✅ Email escrito");

      console.log("📝 Escribiendo password...");
      await page.hover("#pass");
      await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
      await page.click("#pass");
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
      await page.type("#pass", USER_PASSWORD, {
        delay: 50 + Math.random() * 50,
      });
      console.log("✅ Password escrito");

      // Verificar reCAPTCHA antes del submit
      await solveRecaptchaIfPresent();
      logCurrentUrl("antes de hacer click en botón de login");

      console.log("🖱️ Haciendo click en botón de login...");
      await Promise.all([
        page.click(".js-tkit-loading-button"),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
      ]);
      logCurrentUrl("después del login");
      console.log("✅ Login completado, navegación exitosa");

      // 2) 2FA con detección dinámica de selector
      console.log("🔐 PASO 2: Verificando si se requiere 2FA...");

      // Esperar un momento para que la página se cargue completamente
      await new Promise((r) => setTimeout(r, 2000));
      logCurrentUrl("después de esperar carga completa para 2FA");

      // Verificar si hay un selector de código 2FA
      const twoFASelectors = [
        "#code",
        "input[name='code']",
        "input[name='otp']",
        "input[type='tel']",
        "#authentication-factor-verify-page input",
      ];
      let found = null;
      for (const sel of twoFASelectors) {
        try {
          await page.waitForSelector(sel, { visible: true, timeout: 8000 });
          found = sel;
          console.log(`🔎 Campo 2FA encontrado con selector: ${sel}`);
          break;
        } catch {}
      }

      if (found) {
        console.log(
          "🔐 Se detectó página de 2FA, procediendo con verificación..."
        );
        logCurrentUrl("en página de 2FA");

        // Verificar reCAPTCHA en página de 2FA
        await solveRecaptchaIfPresent();

        const token = generateToken();

        console.log(`📝 Escribiendo código 2FA: ${token}`);
        // Simular comportamiento humano para 2FA
        await page.hover(found);
        await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
        await page.click(found);
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
        await page.type(found, token, { delay: 50 + Math.random() * 50 });
        console.log("✅ Código 2FA escrito");

        logCurrentUrl("antes de hacer click en botón de verificación 2FA");
        console.log("🖱️ Haciendo click en botón de verificación 2FA...");
        await Promise.all([
          page.click("#authentication-factor-verify-page input[type='submit']"),
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
        ]);
        logCurrentUrl("después de completar 2FA");
        console.log("✅ 2FA completado, navegación exitosa");
      } else {
        console.log("✅ No se detectó página de 2FA, el login fue directo");
      }

      // 🍪 GUARDAR COOKIES después del login exitoso
      console.log("🍪 Guardando cookies después del login exitoso...");
      await saveCookies(page);

      // 3) Navegar al dashboard
      console.log("🏠 PASO 3: Navegando al dashboard...");
      logCurrentUrl("antes de navegar al dashboard");
      await page.goto(
        "https://perlastore6.mitiendanube.com/admin/v2/apps/envionube/ar/dashboard",
        { waitUntil: "networkidle2", timeout: 60000 }
      );
      logCurrentUrl("después de navegar al dashboard");

      // Verificar reCAPTCHA en el dashboard
      await solveRecaptchaIfPresent();
      logCurrentUrl("después de verificar reCAPTCHA en dashboard");

      // Esperar a que la aplicación se cargue completamente
      console.log(
        "⏳ Esperando a que la aplicación se cargue completamente..."
      );

      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts && !authHeader) {
        await new Promise((r) => setTimeout(r, 1000));
        attempts++;

        console.log(
          `⏳ Intento ${attempts}/${maxAttempts} - Token: ${
            authHeader ? "CAPTURADO" : "No capturado"
          }`
        );

        if (authHeader) {
          console.log("✅ Token capturado durante la espera!");
          logCurrentUrl("después de capturar token durante espera");
          break;
        }
      }

      if (!authHeader) {
        console.log(
          "⚠️ Tiempo máximo de espera alcanzado, intentando refrescar la página..."
        );
        logCurrentUrl("antes del refresh final");
        await page.reload({ waitUntil: "networkidle2", timeout: 60000 });
        logCurrentUrl("después del refresh final");
        await new Promise((r) => setTimeout(r, 3000));

        // Verificar reCAPTCHA después del refresh
        await solveRecaptchaIfPresent();

        // Esperar un poco más después del refresh
        let refreshAttempts = 0;
        const maxRefreshAttempts = 10;

        while (refreshAttempts < maxRefreshAttempts && !authHeader) {
          await new Promise((r) => setTimeout(r, 1000));
          refreshAttempts++;
          console.log(
            `⏳ Refresh intento ${refreshAttempts}/${maxRefreshAttempts} - Token: ${
              authHeader ? "CAPTURADO" : "No capturado"
            }`
          );

          if (authHeader) {
            console.log("✅ Token capturado después del refresh!");
            logCurrentUrl("después de capturar token tras refresh final");
            break;
          }
        }
      }
    }

    if (!authHeader) {
      logCurrentUrl("cuando falla captura de authHeader");
      throw new Error("No se capturó ningún header Authorization");
    }

    // 4) Dentro del iframe de la app
    logCurrentUrl("antes de buscar iframe");
    const iframeH = await page.waitForSelector(
      'iframe[data-testid="iframe-app"]',
      {
        visible: true,
        timeout: 30000,
      }
    );
    const frame = await iframeH.contentFrame();
    if (!frame) throw new Error("No se pudo leer el iframe");
    console.log("✅ Iframe encontrado y accedido");

    // 5) Buscar el orderId
    const searchInput = await frame.waitForSelector(
      ".nimbus-input_input__rlcyv70",
      { visible: true, timeout: 30000 }
    );
    await searchInput.click();
    await searchInput.type(orderId, { delay: 50 });
    await searchInput.press("Enter");
    console.log(`✅ Búsqueda de orden ${orderId} ejecutada`);

    // Esperar a que aparezca la fila
    await frame.waitForFunction(
      (id) =>
        Array.from(document.querySelectorAll("table")).some((t) =>
          t.innerText.includes(id)
        ),
      { timeout: 30000 },
      orderId
    );

    // 6) Click directo en el <a> de la orden para ir a detalle
    const orderSelector =
      "tbody.nimbus-table_container__body__1ifaixp2:nth-child(2) > tr:nth-child(1) > td:nth-child(2) > a:nth-child(1)";
    await frame.waitForSelector(orderSelector, {
      visible: true,
      timeout: 30000,
    });
    logCurrentUrl("antes de navegar a detalles de orden");
    await Promise.all([
      frame.click(orderSelector),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    ]);
    logCurrentUrl("después de navegar a detalles de orden");
    console.log(`✅ Navegado a detalles de la orden ${orderId}`);

    // --- NUEVO BLOQUE: extraer el ID de la URL ---
    const fullUrl = page.url();
    console.log(`🔗 URL completa para extraer ID: ${fullUrl}`);
    const match = fullUrl.match(/#\/shipping-details\/([^/?#]+)/);
    const shippingDetailsId = match ? match[1] : null;

    if (!shippingDetailsId) {
      throw new Error(
        `No pude extraer el ID de shipping-details de la URL: ${fullUrl}`
      );
    }
    console.log(`🆔 Shipping Details ID: ${shippingDetailsId}`);

    // --- Nuevo paso: enviar POST a dispatches ---
    const dispatchUrl =
      "https://nuvem-envio-app-back.ms.tiendanube.com/stores/dispatches";
    const payload = {
      createFile: {},
      contentDeclaration: false,
      label: true,
      ordersIds: [shippingDetailsId],
    };
    const response = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Error enviando dispatch (${response.status}): ${errText}`
      );
    }
    console.log("🚀 Dispatch enviado con éxito:", payload);

    return { authHeader, shippingDetailsId };
  } catch (err) {
    console.error("💥 Error en loginTiendanube:", err.message);

    // Si hay error, eliminar cookies por si están corruptas
    console.log("🗑️ Eliminando cookies por posible corrupción...");
    await deleteCookiesFile();

    throw err;
  } finally {
    if (browser) {
      console.log("🔒 Cerrando navegador...");
      await browser.close();
      console.log("✅ Browser cerrado");
    }
  }
}

// --- Express webhook ---
const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const { orderId } = req.body;
  const token = req.headers["x-token"];
  if (!orderId) return res.status(400).send("Falta orderId en body");
  if (token !== API_TOKEN) return res.status(403).send("Token inválido");

  console.log("🔔 Webhook recibido, orderId:", orderId);
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      console.log(`🔄 Intento ${i} de login + extracción`);
      const { authHeader, shippingDetailsId } = await loginTiendanube(orderId);
      // Devolver respuesta exitosa 200
      return res.status(200).send({
        message: `Proceso completado con éxito en intento ${i}`,
        authHeader,
        shippingDetailsId,
      });
    } catch (err) {
      console.error(`❌ Error intento ${i}:`, err.message);
      if (i === Number(MAX_ATTEMPTS)) {
        return res
          .status(500)
          .send(`No fue posible completar el proceso: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
});

app.listen(PORT, () =>
  console.log(`⚡️ Servidor escuchando en http://localhost:${PORT}`)
);

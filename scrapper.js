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
  SIMPLE_MODE = false,
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

// NUEVAS FUNCIONES ANTI-DETECCIÓN AVANZADAS
async function addAdvancedAntiDetection(page) {
  // 1. Evasión de detección de headless más sofisticada
  await page.evaluateOnNewDocument(() => {
    // Simular propiedades del navegador real
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Agregar propiedades faltantes del navegador
    window.chrome = {
      runtime: {
        onConnect: null,
        onMessage: null,
      },
      loadTimes: function () {
        return {
          commitLoadTime: Date.now() / 1000 - Math.random() * 60,
          finishDocumentLoadTime: Date.now() / 1000 - Math.random() * 10,
          finishLoadTime: Date.now() / 1000 - Math.random() * 5,
          firstPaintTime: Date.now() / 1000 - Math.random() * 10,
          navigationType: "navigate",
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false,
        };
      },
      csi: function () {
        return {
          pageT: Date.now(),
          tran: 15,
        };
      },
      app: {
        isInstalled: false,
        InstallState: "not_installed",
        RunningState: "cannot_run",
      },
    };

    // Simular propiedades de pantalla realistas
    Object.defineProperty(window, "outerWidth", {
      get: () => window.innerWidth,
    });
    Object.defineProperty(window, "outerHeight", {
      get: () => window.innerHeight + Math.floor(Math.random() * 100),
    });

    // Simular timezone y propiedades de fecha
    const getTimezoneOffset = Date.prototype.getTimezoneOffset;
    Date.prototype.getTimezoneOffset = function () {
      return getTimezoneOffset.apply(this) + Math.floor(Math.random() * 2);
    };

    // Evasión de detección de automatización más avanzada
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // Simular hardware más realista
    Object.defineProperty(navigator, "hardwareConcurrency", {
      get: () => 4 + Math.floor(Math.random() * 4),
    });

    Object.defineProperty(navigator, "deviceMemory", {
      get: () => 8,
    });

    // Simular plugins de navegador real
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        {
          name: "Chrome PDF Plugin",
          filename: "internal-pdf-viewer",
          description: "Portable Document Format",
        },
        {
          name: "Chrome PDF Viewer",
          filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
          description: "",
        },
        {
          name: "Native Client",
          filename: "internal-nacl-plugin",
          description: "",
        },
      ],
    });

    // Evasión de detección de canvas fingerprinting
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type) {
      const context = getContext.apply(this, arguments);
      if (type === "2d") {
        const originalFillText = context.fillText;
        context.fillText = function () {
          // Agregar ruido mínimo al texto para evitar fingerprinting
          const args = Array.from(arguments);
          if (args[1]) args[1] += Math.random() * 0.1;
          if (args[2]) args[2] += Math.random() * 0.1;
          return originalFillText.apply(this, args);
        };
      }
      return context;
    };

    // Evasión de detección de WebGL fingerprinting
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) {
        return "Intel Open Source Technology Center";
      }
      if (parameter === 37446) {
        return "Mesa DRI Intel(R) HD Graphics 5500 (Broadwell GT2)";
      }
      return getParameter.apply(this, arguments);
    };

    // Simular eventos de interacción humana
    ["mousemove", "keydown", "scroll"].forEach((eventType) => {
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (
        type,
        listener,
        options
      ) {
        if (type === eventType) {
          const originalListener = listener;
          listener = function (event) {
            // Agregar propiedades humanas al evento
            if (eventType === "mousemove") {
              Object.defineProperty(event, "isTrusted", { value: true });
            }
            return originalListener.apply(this, arguments);
          };
        }
        return originalAddEventListener.call(this, type, listener, options);
      };
    });
  });

  // 2. Configurar headers HTTP más realistas y variables
  const randomHeaders = {
    "Accept-Language": [
      "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7",
      "es-AR,es;q=0.9,en;q=0.8",
    ][Math.floor(Math.random() * 2)],
    "Accept-Encoding": "gzip, deflate, br",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-User": "?1",
    "Sec-Fetch-Dest": "document",
    "Cache-Control": ["max-age=0", "no-cache"][Math.floor(Math.random() * 2)],
    DNT: "1",
    Connection: "keep-alive",
  };

  await page.setExtraHTTPHeaders(randomHeaders);

  // 3. Simular viewport y características de dispositivo realistas
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
  ];
  const selectedViewport =
    viewports[Math.floor(Math.random() * viewports.length)];

  await page.setViewport({
    ...selectedViewport,
    deviceScaleFactor: 1 + Math.random() * 0.5,
    isMobile: false,
    hasTouch: false,
    isLandscape: selectedViewport.width > selectedViewport.height,
  });
}

// Función mejorada para simular comportamiento humano
async function simulateHumanBehavior(page) {
  // Movimientos de mouse más naturales con curvas
  const moveMouseNaturally = async (targetX, targetY, steps = 10) => {
    const currentMouse = await page.mouse;
    let currentX = Math.random() * 100;
    let currentY = Math.random() * 100;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      // Usar curva easing para movimiento más natural
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const x =
        currentX +
        (targetX - currentX) * easeProgress +
        (Math.random() - 0.5) * 5;
      const y =
        currentY +
        (targetY - currentY) * easeProgress +
        (Math.random() - 0.5) * 5;

      await currentMouse.move(x, y);
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 20));
    }
  };

  // Simular scroll natural
  const naturalScroll = async () => {
    const scrollSteps = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < scrollSteps; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, 100 + Math.random() * 200);
      });
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
    }
  };

  // Simular pausas de lectura
  const readingPause = async () => {
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
  };

  // Movimientos aleatorios de exploración
  for (let i = 0; i < 3; i++) {
    await moveMouseNaturally(Math.random() * 800, Math.random() * 600);
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
  }

  await naturalScroll();
  await readingPause();
}

// Función mejorada para typing humano
async function humanType(page, selector, text, options = {}) {
  const element = await page.$(selector);
  if (!element) throw new Error(`Element ${selector} not found`);

  // Hacer hover y focus con delay natural
  await page.hover(selector);
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

  await page.click(selector);
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

  // Simular errores de tipeo ocasionales
  const shouldMakeTypo = Math.random() < 0.1; // 10% chance de error

  if (shouldMakeTypo && text.length > 5) {
    // Escribir con un error y luego corregir
    const errorPos = Math.floor(Math.random() * (text.length - 2)) + 1;
    const beforeError = text.substring(0, errorPos);
    const afterError = text.substring(errorPos);

    // Escribir hasta el error
    await page.type(selector, beforeError, { delay: 80 + Math.random() * 40 });

    // Escribir carácter incorrecto
    await page.type(selector, "x", { delay: 80 + Math.random() * 40 });
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

    // Corregir con backspace
    await page.keyboard.press("Backspace");
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

    // Continuar con el resto
    await page.type(selector, afterError, { delay: 80 + Math.random() * 40 });
  } else {
    // Typing normal con variación en velocidad
    for (const char of text) {
      await page.type(selector, char, { delay: 60 + Math.random() * 80 });

      // Pausas ocasionales como si estuviera pensando
      if (Math.random() < 0.05) {
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
      }
    }
  }
}

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

// MODO SIMPLE (como index.js)
async function simpleLogin(orderId) {
  console.log("🔄 Usando MODO SIMPLE (como index.js)");

  const browser = await puppeteer.launch({
    headless: "shell",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    let authHeader = null;

    // Interceptar requests
    page.on("request", (req) => {
      const url = req.url();
      if (
        (url.includes("/stores/orders") ||
          url.includes("/api/") ||
          url.includes("/admin/") ||
          url.includes("envionube") ||
          url.includes("nuvem-envio-app-back.ms.tiendanube.com")) &&
        req.headers().authorization
      ) {
        authHeader = req.headers().authorization;
        console.log(
          `✅ Header Authorization capturado (modo simple): ${authHeader.substring(
            0,
            20
          )}...`
        );
      }
    });

    // 1) Login directo
    console.log("🔑 Login directo...");
    await page.goto("https://www.tiendanube.com/login", {
      waitUntil: "networkidle2",
    });
    await page.type("#user-mail", USER_EMAIL, { delay: 100 });
    await page.type("#pass", USER_PASSWORD, { delay: 100 });
    await Promise.all([
      page.click(".js-tkit-loading-button"),
      page.waitForNavigation({ waitUntil: "networkidle2" }),
    ]);

    // 2) 2FA
    console.log("🔐 2FA...");
    const code2FA = generateToken();
    await page.type("#code", code2FA, { delay: 100 });
    await Promise.all([
      page.click("#authentication-factor-verify-page input[type='submit']"),
      page.waitForNavigation({ waitUntil: "networkidle2" }),
    ]);

    // 3) Dashboard
    console.log("🏠 Navegando al dashboard...");
    await page.goto(
      "https://perlastore6.mitiendanube.com/admin/v2/apps/envionube/ar/dashboard",
      { waitUntil: "networkidle2" }
    );

    // Esperar token
    await new Promise((r) => setTimeout(r, 3000));

    if (!authHeader) {
      throw new Error(
        "No se capturó ningún header Authorization (modo simple)"
      );
    }

    // Continuar con el flujo de búsqueda igual que el modo complejo
    const iframeH = await page.waitForSelector(
      'iframe[data-testid="iframe-app"]',
      {
        visible: true,
        timeout: 30000,
      }
    );
    const frame = await iframeH.contentFrame();
    if (!frame) throw new Error("No se pudo leer el iframe");

    const searchInput = await frame.waitForSelector(
      ".nimbus-input_input__rlcyv70",
      {
        visible: true,
        timeout: 30000,
      }
    );
    await searchInput.click();
    await searchInput.type(orderId, { delay: 50 });
    await searchInput.press("Enter");

    await frame.waitForFunction(
      (id) =>
        Array.from(document.querySelectorAll("table")).some((t) =>
          t.innerText.includes(id)
        ),
      { timeout: 30000 },
      orderId
    );

    const orderSelector =
      "tbody.nimbus-table_container__body__1ifaixp2:nth-child(2) > tr:nth-child(1) > td:nth-child(2) > a:nth-child(1)";
    await frame.waitForSelector(orderSelector, {
      visible: true,
      timeout: 30000,
    });
    await Promise.all([
      frame.click(orderSelector),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    ]);

    const fullUrl = page.url();
    const match = fullUrl.match(/#\/shipping-details\/([^/?#]+)/);
    const shippingDetailsId = match ? match[1] : null;

    if (!shippingDetailsId) {
      throw new Error(
        `No pude extraer el ID de shipping-details de la URL: ${fullUrl}`
      );
    }

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

    console.log("🚀 Dispatch enviado con éxito (modo simple):", payload);
    return { authHeader, shippingDetailsId };
  } finally {
    await browser.close();
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
      "--disable-blink-features=AutomationControlled",
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
      "--disable-features=TranslateUI,VizDisplayCompositor",
      "--mute-audio",
      "--no-default-browser-check",
      "--no-pings",
      "--password-store=basic",
      "--use-mock-keychain",
      "--disable-automation",
      "--exclude-switches=enable-automation",
      "--disable-extensions-http-throttling",
      "--metrics-recording-only",
      "--no-report-upload",
      "--safebrowsing-disable-auto-update",
      "--disable-features=VizDisplayCompositor",
      "--run-all-compositor-stages-before-draw",
      "--disable-threaded-animation",
      "--disable-threaded-scrolling",
      "--disable-checker-imaging",
      "--disable-new-content-rendering-timeout",
      "--disable-image-animation-resync",
    ],
    headless: "shell",
    slowMo: 30 + Math.floor(Math.random() * 40),
    defaultViewport: randomViewport,
    ignoreDefaultArgs: ["--disable-extensions", "--enable-automation"],
    ignoreHTTPSErrors: true,
    timeout: 60000,
    devtools: false,
  };

  console.log(
    "🚀 Intentando lanzar browser con configuración anti-detección avanzada..."
  );

  let browser;
  try {
    browser = await puppeteer.launch(browserOptions);
  } catch (launchError) {
    console.error("💥 Error al lanzar el browser:", launchError.message);
    throw new Error(`No se pudo lanzar el browser: ${launchError.message}`);
  }

  try {
    const page = await browser.newPage();

    // APLICAR TÉCNICAS ANTI-DETECCIÓN AVANZADAS
    await addAdvancedAntiDetection(page);

    // Establecer user agent aleatorio
    await page.setUserAgent(randomUA);
    console.log(`🎭 User Agent configurado: ${randomUA.substring(0, 50)}...`);

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

      // Simular comportamiento humano antes del login
      await page.goto("https://www.tiendanube.com", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
      logCurrentUrl("página principal antes de login");

      // Simular exploración humana
      await simulateHumanBehavior(page);

      // Ahora ir al login
      await page.goto("https://www.tiendanube.com/login", {
        waitUntil: "networkidle2",
        timeout: 60000,
      });
      logCurrentUrl("después de navegar a página de login");
      console.log("✅ Página de login cargada");

      // Simular comportamiento de lectura de la página
      await simulateHumanBehavior(page);

      // Verificar y resolver reCAPTCHA si está presente
      await solveRecaptchaIfPresent();
      logCurrentUrl("después de verificar reCAPTCHA en login");

      console.log(`📝 Escribiendo email: ${USER_EMAIL}`);

      // Usar la nueva función de typing humano
      try {
        await humanType(page, "#user-mail", USER_EMAIL);
        console.log("✅ Email escrito con comportamiento humano");
      } catch (emailError) {
        console.log("⚠️ Error con typing humano, usando método alternativo");
        await page.hover("#user-mail");
        await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
        await page.click("#user-mail");
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
        await page.type("#user-mail", USER_EMAIL, {
          delay: 50 + Math.random() * 50,
        });
      }

      // Pausa natural entre campos
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));

      console.log("📝 Escribiendo password...");

      try {
        await humanType(page, "#pass", USER_PASSWORD);
        console.log("✅ Password escrito con comportamiento humano");
      } catch (passError) {
        console.log(
          "⚠️ Error con typing humano en password, usando método alternativo"
        );
        await page.hover("#pass");
        await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
        await page.click("#pass");
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
        await page.type("#pass", USER_PASSWORD, {
          delay: 50 + Math.random() * 50,
        });
      }

      // Simular que el usuario lee los términos o revisa la página
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

      // Verificar reCAPTCHA antes del submit
      await solveRecaptchaIfPresent();
      logCurrentUrl("antes de hacer click en botón de login");

      console.log("🖱️ Haciendo click en botón de login...");

      // Simular hover natural antes del click
      await page.hover(".js-tkit-loading-button");
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

      try {
        await Promise.all([
          page.click(".js-tkit-loading-button"),
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }),
        ]);
        logCurrentUrl("después del login");
        console.log("✅ Login completado, navegación exitosa");
      } catch (loginError) {
        console.error("❌ Error durante el login:", loginError.message);

        // Verificar si seguimos en la página de login (indicador de detección de bot)
        const currentUrl = page.url();
        if (currentUrl.includes("login")) {
          console.error(
            "🚨 DETECTADO COMO BOT - Redirigido de vuelta al login"
          );

          // Intentar técnicas adicionales de evasión
          console.log("🔄 Aplicando técnicas adicionales de evasión...");

          // Limpiar todo y empezar de nuevo con más delays
          await page.evaluate(() => {
            // Limpiar campos
            const emailField = document.querySelector("#user-mail");
            const passField = document.querySelector("#pass");
            if (emailField) emailField.value = "";
            if (passField) passField.value = "";
          });

          // Simular comportamiento muy humano
          await simulateHumanBehavior(page);

          // Esperar más tiempo
          await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));

          // Reintentar con delays más largos
          console.log("🔄 Reintentando login con delays extendidos...");

          await humanType(page, "#user-mail", USER_EMAIL);
          await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));

          await humanType(page, "#pass", USER_PASSWORD);
          await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500));

          await solveRecaptchaIfPresent();

          await page.hover(".js-tkit-loading-button");
          await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));

          await Promise.all([
            page.click(".js-tkit-loading-button"),
            page.waitForNavigation({
              waitUntil: "networkidle2",
              timeout: 60000,
            }),
          ]);
        } else {
          throw loginError;
        }
      }

      // 2) 2FA con detección dinámica de selector
      console.log("🔐 PASO 2: Verificando si se requiere 2FA...");

      // Esperar un momento para que la página se cargue completamente
      await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));
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

        // Simular comportamiento humano en 2FA
        await simulateHumanBehavior(page);

        // Verificar reCAPTCHA en página de 2FA
        await solveRecaptchaIfPresent();

        const token = generateToken();
        console.log(`📝 Escribiendo código 2FA: ${token}`);

        try {
          await humanType(page, found, token);
          console.log("✅ Código 2FA escrito con comportamiento humano");
        } catch (tfaError) {
          console.log(
            "⚠️ Error con typing humano en 2FA, usando método alternativo"
          );
          await page.hover(found);
          await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
          await page.click(found);
          await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
          await page.type(found, token, { delay: 50 + Math.random() * 50 });
        }

        // Pausa antes de enviar 2FA
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1500));

        logCurrentUrl("antes de hacer click en botón de verificación 2FA");
        console.log("🖱️ Haciendo click en botón de verificación 2FA...");

        await page.hover(
          "#authentication-factor-verify-page input[type='submit']"
        );
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));

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

      // 3) Navegar al dashboard con comportamiento humano
      console.log("🏠 PASO 3: Navegando al dashboard...");

      // Simular navegación humana gradual
      await simulateHumanBehavior(page);

      logCurrentUrl("antes de navegar al dashboard");
      await page.goto(
        "https://perlastore6.mitiendanube.com/admin/v2/apps/envionube/ar/dashboard",
        { waitUntil: "networkidle2", timeout: 60000 }
      );
      logCurrentUrl("después de navegar al dashboard");

      // Verificar reCAPTCHA en el dashboard
      await solveRecaptchaIfPresent();
      logCurrentUrl("después de verificar reCAPTCHA en dashboard");

      // Esperar a que la aplicación se cargue completamente con comportamiento humano
      console.log(
        "⏳ Esperando a que la aplicación se cargue completamente..."
      );

      await simulateHumanBehavior(page);

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

        // Simular comportamiento humano antes del refresh
        await simulateHumanBehavior(page);

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

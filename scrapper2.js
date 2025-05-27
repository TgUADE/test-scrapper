require("dotenv").config();
const express = require("express");
const puppeteer = require("puppeteer");
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
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });

    // Captura del header Authorization
    let authHeader = null;
    page.on("request", (request) => {
      if (
        request
          .url()
          .includes("nuvem-envio-app-back.ms.tiendanube.com/stores/orders")
      ) {
        const h = request.headers().authorization;
        if (h) {
          authHeader = h;
          console.log("➡️ Authorization capturado:", authHeader);
        }
      }
    });

    // 1) Login
    await page.goto("https://www.tiendanube.com/login", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await page.type("#user-mail", USER_EMAIL, { delay: 50 });
    await page.type("#pass", USER_PASSWORD, { delay: 50 });
    await Promise.all([
      page.click(".js-tkit-loading-button"),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    ]);

    // 2) 2FA con detección dinámica de selector
    const token = generateToken();
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
    if (!found) {
      await page.screenshot({ path: "2fa-error.png", fullPage: true });
      console.error("❌ No se encontró campo 2FA. HTML en 2fa-error.png");
      throw new Error("Campo 2FA no detectado");
    }
    await page.type(found, token, { delay: 50 });
    await Promise.all([
      page.click("#authentication-factor-verify-page input[type='submit']"),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
    ]);

    // 3) Dashboard (dispara petición orders)
    await page.goto(
      "https://perlastore6.mitiendanube.com/admin/v2/apps/envionube/ar/dashboard",
      { waitUntil: "networkidle2", timeout: 60000 }
    );
    await page.waitForTimeout(1000);

    if (!authHeader) {
      throw new Error("No se capturó ningún header Authorization");
    }

    // 4) Dentro del iframe de la app
    const iframeH = await page.waitForSelector(
      'iframe[data-testid="iframe-app"]',
      {
        visible: true,
        timeout: 30000,
      }
    );
    const frame = await iframeH.contentFrame();
    if (!frame) throw new Error("No se pudo leer el iframe");

    // 5) Buscar el orderId
    const searchInput = await frame.waitForSelector(
      ".nimbus-input_input__rlcyv70",
      { visible: true, timeout: 30000 }
    );
    await searchInput.click();
    await searchInput.type(orderId, { delay: 50 });
    await searchInput.press("Enter");

    // Esperar a que aparezca la fila
    await frame.waitForFunction(
      (id) =>
        Array.from(document.querySelectorAll("table")).some((t) =>
          t.innerText.includes(id)
        ),
      { timeout: 30000 },
      orderId
    );

    // 6) Extraer tabla (opcional logging)
    const tableData = await frame.$$eval("table", (tables) => {
      const table = tables[0];
      return Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.querySelectorAll("th, td")).map((cell) =>
          cell.innerText.trim()
        )
      );
    });
    console.log("📋 Tabla tras búsqueda:", tableData);

    // 7) Seleccionar checkbox, desplegar dropdown
    const rows = await frame.$$("table tbody tr");
    let foundRow = false;
    for (const row of rows) {
      const text = await row.evaluate((r) => r.innerText);
      if (text.includes(orderId)) {
        foundRow = true;
        await row.$eval("td:nth-child(1) label", (el) => el.click());
        await frame.click(
          "div.nimbus-box_position-relative-xs__cklfii129 div:nth-child(1)"
        );
        const optVal = await frame.$eval(
          "#massive-actions > option:nth-child(2)",
          (el) => el.value
        );
        await frame.select("#massive-actions", optVal);
        await frame.click("button.nimbus-button_appearance_primary__fymkre1");
        break;
      }
    }
    if (!foundRow) {
      throw new Error(`Orden ${orderId} no encontrada en la tabla`);
    }

    // 8) Extraer código de seguimiento
    const trackSel =
      "tbody.nimbus-table_container__body__1ifaixp2 tr:nth-child(1) td:nth-child(6) a";
    await frame.waitForSelector(trackSel, { visible: true, timeout: 30000 });
    const fullTracking = await frame.$eval(
      trackSel,
      (a) => a.getAttribute("title") || a.textContent.trim()
    );

    console.log("📦 Código de seguimiento:", fullTracking);
    return { authHeader, tracking: fullTracking };
  } finally {
    await browser.close();
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
      const { authHeader, tracking } = await loginTiendanube(orderId);
      return res.json({ authorization: authHeader, tracking });
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

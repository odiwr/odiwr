import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data", "content.json");
const CONTACT_MESSAGES_PATH = path.join(__dirname, "data", "contact-messages.json");
const CONTACT_TO = process.env.CONTACT_TO || "biz@odiwr.com";
const CONTACT_FROM =
  process.env.CONTACT_FROM || "ODIWR Site <no-reply@odiwr.com>";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const appendContactMessage = (entry) => {
  let existing = [];
  try {
    const raw = fs.readFileSync(CONTACT_MESSAGES_PATH, "utf8");
    existing = JSON.parse(raw);
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
  existing.push(entry);
  fs.writeFileSync(CONTACT_MESSAGES_PATH, JSON.stringify(existing, null, 2));
};

const markdownToHtml = (source) => {
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
};

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
};

app.get("/api/content", (_req, res) => {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    res.json(JSON.parse(raw));
  } catch {
    res.status(500).json({ error: "Unable to read content." });
  }
});

app.post("/api/content", (req, res) => {
  const { token, content } = req.body || {};
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!content || typeof content !== "object") {
    return res.status(400).json({ error: "Invalid content" });
  }

  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(content, null, 2));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Unable to save content." });
  }
});

app.post("/api/contact", async (req, res) => {
  const { fullName, subject, message, messageMarkdown } = req.body || {};

  if (
    !fullName ||
    !subject ||
    !message ||
    typeof fullName !== "string" ||
    typeof subject !== "string" ||
    typeof message !== "string"
  ) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const markdownBody =
    typeof messageMarkdown === "string"
      ? messageMarkdown.trim().slice(0, 10000)
      : "";

  const safeEntry = {
    fullName: fullName.trim().slice(0, 160),
    subject: subject.trim().slice(0, 220),
    message: message.trim().slice(0, 10000),
    messageMarkdown: markdownBody,
    messageHtml: markdownToHtml(markdownBody || message),
    to: CONTACT_TO,
    createdAt: new Date().toISOString()
  };

  if (!safeEntry.fullName || !safeEntry.subject || !safeEntry.message) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    appendContactMessage(safeEntry);
  } catch {
    return res.status(500).json({ error: "Unable to persist message." });
  }

  const transporter = getTransporter();
  if (!transporter) {
    return res.status(500).json({
      error:
        "Email transport is not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS."
    });
  }

  const plainBody = `From: ${safeEntry.fullName}\nSubject: ${safeEntry.subject}\n\n${safeEntry.message}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.45;">
      <p><strong>From:</strong> ${safeEntry.fullName}</p>
      <p><strong>Subject:</strong> ${safeEntry.subject}</p>
      <hr />
      <div>${safeEntry.messageHtml}</div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: CONTACT_FROM,
      to: CONTACT_TO,
      replyTo: CONTACT_TO,
      subject: `[ODIWR Contact] ${safeEntry.subject}`,
      text: plainBody,
      html: htmlBody
    });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Unable to send message through SMTP." });
  }
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

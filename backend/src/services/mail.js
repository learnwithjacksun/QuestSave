import { BrevoClient } from "@getbrevo/brevo";
import env from "../config/env.js";
import { AppError } from "../utils/AppError.js";

let client;

function getClient() {
  if (!env.brevo.apiKey) {
    throw new AppError("Email is not configured on the server.", 500);
  }

  if (!client) {
    client = new BrevoClient({ apiKey: env.brevo.apiKey });
  }

  return client;
}

export async function sendOtpEmail(to, code) {
  const brevo = getClient();

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: {
        name: env.brevo.fromName,
        email: env.brevo.fromEmail,
      },
      to: [{ email: to }],
      subject: "Your QuestSave sign-in code",
      textContent: `Your QuestSave code is ${code}. It expires in 10 minutes.`,
      htmlContent: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 420px; margin: 0 auto; color: #111;">
        <h1 style="font-size: 20px;">QuestSave</h1>
        <p>Your sign-in code is:</p>
        <p style="font-size: 32px; letter-spacing: 6px; font-weight: 700; color: #FE6022;">${code}</p>
        <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn’t request it, you can ignore this email.</p>
      </div>
    `,
    });
  } catch (err) {
    console.error("Brevo send failed", err);
    throw new AppError("Could not send the sign-in code. Try again.", 502);
  }
}

import nodemailer from 'nodemailer';

export async function sendFailureEmail(subject: string, body: string): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.ALERT_EMAIL_TO;

  if (!user || !pass || !to) {
    console.error(
      '[sync-sheet] GMAIL_USER, GMAIL_APP_PASSWORD, or ALERT_EMAIL_TO is not set, skipping failure email.'
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  try {
    await transporter.sendMail({ from: user, to, subject, text: body });
    console.error('[sync-sheet] Failure email sent.');
  } catch (err) {
    console.error('[sync-sheet] Failed to send failure email:', err);
  }
}

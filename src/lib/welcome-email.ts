export function welcomeEmailHtml(name: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.06)">

    <!-- header -->
    <tr>
      <td style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:36px 40px;text-align:center">
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.03em">
          <span style="color:#fbbf24">ab</span>CV
        </h1>
        <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.85);font-weight:400">
          AI-powered CV generator
        </p>
      </td>
    </tr>

    <!-- body -->
    <tr>
      <td style="padding:36px 40px">
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">
          Welcome to abCV, ${name}!
        </h2>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151">
          Thanks for signing up. We're thrilled to have you on board.
        </p>
        <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#374151">
          Here's what you can do right now:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 20px">
          <tr>
            <td style="padding:4px 8px 4px 0;font-size:14px;color:#374151;vertical-align:top;width:20px">✦</td>
            <td style="padding:4px 0;font-size:14px;color:#374151;line-height:1.5">Paste any job posting — we extract skills &amp; requirements</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;font-size:14px;color:#374151;vertical-align:top">✦</td>
            <td style="padding:4px 0;font-size:14px;color:#374151;line-height:1.5">Generate realistic, role-tailored work experience</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;font-size:14px;color:#374151;vertical-align:top">✦</td>
            <td style="padding:4px 0;font-size:14px;color:#374151;line-height:1.5">Choose from 9 beautiful templates and customise every detail</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;font-size:14px;color:#374151;vertical-align:top">✦</td>
            <td style="padding:4px 0;font-size:14px;color:#374151;line-height:1.5">Download a polished PDF or cover letter in seconds</td>
          </tr>
        </table>

        <div style="margin:24px 0;padding:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
          <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#166534">
            🎉 Your sample CV is attached
          </p>
          <p style="margin:0;font-size:13px;color:#15803d;line-height:1.5">
            We've generated a sample CV so you can see what abCV can do. 
            Open the attachment above, or head to the dashboard to create your own.
          </p>
        </div>

        <a href="https://provisions-ward-resolve-bedding.trycloudflare.com/dashboard"
           style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;margin:8px 0 4px">
          Go to dashboard →
        </a>
      </td>
    </tr>

    <!-- footer -->
    <tr>
      <td style="padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center">
        <p style="margin:0 0 4px;font-size:12px;color:#9ca3af">
          abCV &mdash; made with ❤️
        </p>
        <p style="margin:0;font-size:11px;color:#9ca3af">
          If you didn't sign up for abCV, you can safely ignore this email.
        </p>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// HTML + plain-text bodies for BOB's lifecycle emails. The look matches the sign-up email in
// supabase/email-templates/confirm-signup.html (table layout and inline styles only, because email
// clients ignore <style> blocks). Every interpolated value goes through esc().
const APP_URL = () => (process.env.APP_URL || 'https://getbob.agency').trim().replace(/\/$/, '');

const PRICES = { individual: 29, producer_plus: 39, agency_owner: 79 };

function esc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function money(n) { return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`; }
function fmtDay(date) {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
}
function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }

function layout({ preheader, title, bodyHtml, buttonLabel, buttonUrl }) {
  const button = buttonLabel ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
              <tr>
                <td align="center" style="background-color:#A63D40; border-radius:12px;">
                  <a href="${esc(buttonUrl)}" style="display:inline-block; padding:14px 30px; font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#FFFFFF; text-decoration:none;">${esc(buttonLabel)}</a>
                </td>
              </tr>
            </table>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#FBF7F1;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#FBF7F1;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FBF7F1;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td align="center" style="padding:0 0 18px 0; font-family:Georgia,'Times New Roman',serif; font-size:22px; font-weight:bold; color:#A63D40;">
            <img src="https://getbob.agency/icons/icon-192.png" width="84" height="84" alt="BOB" style="display:block; margin:0 auto 4px auto; border:0;">
            Book of Business
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF; border-radius:16px; padding:36px 32px; border:1px solid #D8CBB8;">
            <h1 style="margin:0 0 14px 0; font-family:Georgia,'Times New Roman',serif; font-size:26px; line-height:1.25; color:#3A2E27;">${esc(title)}</h1>
${bodyHtml}
${button}
            <p style="margin:0; padding-top:18px; border-top:1px solid #D8CBB8; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:1.5; color:#7D6C5E;">Questions? Just reply to this email, or write to <a href="mailto:support@getbob.agency" style="color:#7D6C5E;">support@getbob.agency</a>. A real person reads every message.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:22px 12px 0 12px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.6; color:#7D6C5E;">
            BOB &mdash; Book of Business &middot; <a href="https://getbob.agency" style="color:#7D6C5E;">getbob.agency</a><br>
            Independent software for licensed producers. Not affiliated with any carrier.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function p(html) {
  return `            <p style="margin:0 0 18px 0; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:1.55; color:#3A2E27;">${html}</p>`;
}
function callout(html) {
  return `            <p style="margin:0 0 22px 0; padding:14px 16px; background-color:#F2E9DC; border-radius:10px; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.5; color:#3A2E27;">${html}</p>`;
}
function list(items) {
  return `            <ol style="margin:0 0 22px 0; padding-left:22px; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:1.6; color:#3A2E27;">${items.map((i) => `<li style="margin-bottom:6px;">${i}</li>`).join('')}</ol>`;
}

function foundingLine(number, percentOff) {
  return `You're <strong>Founding Member #${esc(number)}</strong>. Your ${esc(percentOff)}% discount is locked in for as long as you remain a paid subscription member.`;
}

// producer: { name, foundingNumber, trialEndsAt (Date) , trialActive (bool) }
// founding: { enabled (bool), percentOff }
function welcomeEmail({ producer, trialEndsAt, trialActive, founding }) {
  const name = firstName(producer.name);
  const isFounding = !!(founding.enabled && producer.foundingNumber);
  const ends = fmtDay(trialEndsAt);
  const steps = [
    'Open the <strong>Book</strong> tab and add a client and a case.',
    'Add your lead costs and other expenses in <strong>Costs</strong>.',
    'Look at <strong>Profit</strong> to see what you actually net.',
  ];
  const intro = trialActive
    ? `Your account is ready, and your 14-day free trial is running. You have full Producer Plus access through <strong>${esc(ends)}</strong>, and no card is needed.`
    : 'Your account is ready. Your free trial was already used on an earlier account, so choose a plan to get started. You can do it from the Subscribe page as soon as you sign in.';
  const bodyHtml = [
    p(`Hi ${esc(name)},`),
    p(`Welcome to BOB. ${intro}`),
    isFounding ? callout(foundingLine(producer.foundingNumber, founding.percentOff)) : '',
    p('A good first ten minutes:'),
    list(steps),
    p('Have a spreadsheet of your cases? Reply to this email and I\'ll help you import it so you\'re not starting from zero.'),
    p('Thanks for trying BOB. I\'d love to hear what works and what doesn\'t. There\'s a Feedback tab inside the app, and I read every message.'),
    p('Gustin<br><span style="color:#7D6C5E; font-size:14px;">Founder, BOB</span>'),
  ].filter(Boolean).join('\n');

  const text = [
    `Hi ${name},`,
    '',
    trialActive
      ? `Welcome to BOB. Your account is ready, and your 14-day free trial is running. You have full Producer Plus access through ${ends}, no card needed.`
      : 'Welcome to BOB. Your account is ready. Your free trial was already used on an earlier account, so choose a plan to get started from the Subscribe page.',
    isFounding ? `\nYou're Founding Member #${producer.foundingNumber}. Your ${founding.percentOff}% discount is locked in for as long as you remain a paid subscription member.` : '',
    '',
    'A good first ten minutes:',
    '1. Open the Book tab and add a client and a case.',
    '2. Add your lead costs and other expenses in Costs.',
    '3. Look at Profit to see what you actually net.',
    '',
    'Have a spreadsheet of your cases? Reply to this email and I\'ll help you import it.',
    '',
    'Thanks for trying BOB. There\'s a Feedback tab inside the app, and I read every message.',
    '',
    'Gustin, Founder, BOB',
    `${APP_URL()}/app.html`,
  ].join('\n');

  return {
    subject: isFounding ? `Welcome to BOB, Founding Member #${producer.foundingNumber}` : 'Welcome to BOB',
    html: layout({
      preheader: trialActive ? `Your 14-day trial runs through ${ends}.` : 'Your account is ready.',
      title: 'Welcome to BOB',
      bodyHtml,
      buttonLabel: 'Open BOB',
      buttonUrl: `${APP_URL()}/app.html`,
    }),
    text,
  };
}

function priceRows(isFounding, percentOff) {
  const rows = [['Producer', 'individual'], ['Producer Plus', 'producer_plus'], ['Agency', 'agency_owner']];
  return rows.map(([label, key]) => {
    const reg = PRICES[key];
    const mine = isFounding ? reg * (1 - percentOff / 100) : reg;
    return { label, reg, mine };
  });
}

function trialEndingEmail({ producer, trialEndsAt, founding }) {
  const name = firstName(producer.name);
  const isFounding = !!(founding.enabled && producer.foundingNumber);
  const ends = fmtDay(trialEndsAt);
  const rows = priceRows(isFounding, founding.percentOff);
  const tableHtml = `            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; color:#3A2E27;">${rows.map((r) => `
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #EFE6D8;">${esc(r.label)}</td>
                <td align="right" style="padding:8px 0; border-bottom:1px solid #EFE6D8;">${isFounding ? `<span style="color:#7D6C5E; text-decoration:line-through;">${money(r.reg)}</span> &nbsp;` : ''}<strong>${money(r.mine)}/mo</strong></td>
              </tr>`).join('')}
            </table>`;
  const bodyHtml = [
    p(`Hi ${esc(name)},`),
    p(`Your BOB free trial ends on <strong>${esc(ends)}</strong>. To keep using BOB after that, choose a plan. It takes about a minute.`),
    isFounding ? callout(foundingLine(producer.foundingNumber, founding.percentOff) + ' Your discount is applied automatically at checkout.') : '',
    tableHtml,
    p('Your clients, cases and numbers stay saved either way. Nothing is deleted if you decide to wait.'),
    p('Not sure which plan fits, or something didn\'t work the way you hoped? Reply and tell me. I\'d rather fix it than lose you.'),
    p('Gustin<br><span style="color:#7D6C5E; font-size:14px;">Founder, BOB</span>'),
  ].filter(Boolean).join('\n');

  const text = [
    `Hi ${name},`,
    '',
    `Your BOB free trial ends on ${ends}. To keep using BOB after that, choose a plan (it takes about a minute).`,
    isFounding ? `\nYou're Founding Member #${producer.foundingNumber}. Your ${founding.percentOff}% discount is locked in for as long as you remain a paid subscription member, and it's applied automatically at checkout.` : '',
    '',
    ...rows.map((r) => `${r.label}: ${isFounding ? `${money(r.mine)}/mo (regularly ${money(r.reg)})` : `${money(r.mine)}/mo`}`),
    '',
    'Your clients, cases and numbers stay saved either way.',
    '',
    'Not sure which plan fits, or something didn\'t work the way you hoped? Reply and tell me.',
    '',
    'Gustin, Founder, BOB',
    `${APP_URL()}/app.html  (click Subscribe in the left menu)`,
  ].join('\n');

  return {
    subject: `Your BOB trial ends ${ends}`,
    html: layout({
      preheader: `Choose a plan to keep your numbers going after ${ends}.`,
      title: `Your trial ends ${ends}`,
      bodyHtml,
      buttonLabel: 'Choose a plan',
      buttonUrl: `${APP_URL()}/app.html`,
    }),
    text,
  };
}

module.exports = { welcomeEmail, trialEndingEmail };

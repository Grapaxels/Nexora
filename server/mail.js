import net from 'node:net';
import tls from 'node:tls';
import { randomUUID } from 'node:crypto';

function smtpReader(socket) {
  let buffer = '';
  let current = [];
  const queued = [];
  const waiting = [];
  let failed;
  const flush = response => waiting.length ? waiting.shift().resolve(response) : queued.push(response);
  const onData = chunk => {
    buffer += chunk.toString('utf8');
    let end;
    while ((end = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      current.push(line);
      const match = line.match(/^(\d{3})([ -])/);
      if (match?.[2] === ' ') {
        flush({ code: Number(match[1]), text: current.join('\n') });
        current = [];
      }
    }
  };
  const onError = error => {
    failed = error;
    while (waiting.length) waiting.shift().reject(error);
  };
  socket.on('data', onData);
  socket.on('error', onError);
  return {
    next() {
      if (failed) return Promise.reject(failed);
      if (queued.length) return Promise.resolve(queued.shift());
      return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
    },
    dispose() {
      socket.off('data', onData);
      socket.off('error', onError);
    }
  };
}

async function expect(reader, codes) {
  const response = await reader.next();
  if (!codes.includes(response.code)) throw new Error(`SMTP server returned ${response.code}.`);
  return response;
}

async function command(socket, reader, value, codes = [250]) {
  socket.write(`${value}\r\n`);
  return expect(reader, codes);
}

function connectSocket(options, secure) {
  return new Promise((resolve, reject) => {
    const socket = secure ? tls.connect(options) : net.createConnection(options);
    const event = secure ? 'secureConnect' : 'connect';
    const timer = setTimeout(() => socket.destroy(new Error('SMTP connection timed out.')), 15000);
    socket.once(event, () => { clearTimeout(timer); resolve(socket); });
    socket.once('error', error => { clearTimeout(timer); reject(error); });
  });
}

function emailAddress(value, label) {
  if (!value || /[\r\n]/.test(value)) throw new Error(`${label} is invalid.`);
  const bracketed = value.match(/<([^<>]+)>$/)?.[1];
  const address = bracketed || value;
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) throw new Error(`${label} is invalid.`);
  return address;
}

async function sendWithSmtp({ to, code }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const fromHeader = process.env.SMTP_FROM || process.env.MAIL_FROM;
  const from = emailAddress(fromHeader, 'SMTP_FROM');
  emailAddress(to, 'Recipient email');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT is invalid.');
  const tlsOptions = { host, port, servername: host, rejectUnauthorized: true };
  let socket = await connectSocket(tlsOptions, secure);
  let reader = smtpReader(socket);
  await expect(reader, [220]);
  const helo = /^[a-z0-9.-]+$/i.test(process.env.SMTP_HELO || '') ? process.env.SMTP_HELO : 'localhost';
  await command(socket, reader, `EHLO ${helo}`);
  if (!secure) {
    await command(socket, reader, 'STARTTLS', [220]);
    reader.dispose();
    socket = await new Promise((resolve, reject) => {
      const upgraded = tls.connect({ socket, servername: host, rejectUnauthorized: true }, () => resolve(upgraded));
      upgraded.once('error', reject);
    });
    reader = smtpReader(socket);
    await command(socket, reader, `EHLO ${helo}`);
  }
  if (process.env.SMTP_USER || process.env.SMTP_PASS) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Both SMTP_USER and SMTP_PASS are required.');
    await command(socket, reader, 'AUTH LOGIN', [334]);
    await command(socket, reader, Buffer.from(process.env.SMTP_USER).toString('base64'), [334]);
    await command(socket, reader, Buffer.from(process.env.SMTP_PASS).toString('base64'), [235]);
  }
  await command(socket, reader, `MAIL FROM:<${from}>`);
  await command(socket, reader, `RCPT TO:<${to}>`, [250, 251]);
  await command(socket, reader, 'DATA', [354]);
  const body = Buffer.from(`Your Nexora verification code is ${code}.\n\nIt expires in 10 minutes. If you did not request it, ignore this email.`, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
  const domain = from.split('@')[1];
  socket.write(`From: ${fromHeader}\r\nTo: ${to}\r\nSubject: Your Nexora sign-in code\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: <${randomUUID()}@${domain}>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${body}\r\n.\r\n`);
  await expect(reader, [250]);
  await command(socket, reader, 'QUIT', [221]);
  reader.dispose();
  socket.end();
}

async function sendWithResend({ to, code }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      subject: 'Your Nexora sign-in code',
      text: `Your Nexora verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`
    })
  });
  if (!response.ok) throw new Error('Mail provider rejected the request.');
}

export function mailProvider() {
  if (process.env.SMTP_HOST) return 'smtp';
  if (process.env.RESEND_API_KEY) return 'resend';
  return null;
}

export async function sendVerificationCode(details) {
  if (process.env.SMTP_HOST) return sendWithSmtp(details);
  if (process.env.RESEND_API_KEY) return sendWithResend(details);
  throw new Error('No email provider is configured.');
}

const nodemailer = require('nodemailer');
const logger = require('../utils/loggerUtils');

let transporter;
async function init() {
  if (transporter) return transporter;
  if (process.env.NODE_ENV==='production') {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE==='true',
      auth: { user:process.env.SMTP_USER, pass:process.env.SMTP_PASSWORD }
    });
  } else {
    const testAcc = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host:'smtp.ethereal.email', port:587, secure:false,
      auth:{user:testAcc.user,pass:testAcc.pass}
    });
    logger.info(`Ethereal account: ${testAcc.user}`);
  }
  return transporter;
}

async function sendEmail({ to, subject, text, html, from }) {
  const t = await init();
  const info = await t.sendMail({
    from: from||`"FitTrackJS"<${process.env.DEFAULT_FROM_EMAIL||'no-reply@fittrackjs.com'}>`,
    to, subject, text, html
  });
  logger.info(`Email sent: ${info.messageId}`);
  if (process.env.NODE_ENV!=='production') {
    logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
  return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
}

module.exports = { sendEmail };

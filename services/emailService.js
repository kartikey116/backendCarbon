// In services/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address in .env
        pass: process.env.EMAIL_PASS, // Your Gmail "App Password" in .env
    },
});

async function sendOtpEmail(to, otp) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: 'Your Blue Carbon Registry Verification Code',
        text: `Your OTP is: ${otp}. It is valid for 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${to}`);
}

module.exports = { sendOtpEmail };
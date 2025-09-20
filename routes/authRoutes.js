// In routes/authRoutes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../services/emailService');

const prisma = new PrismaClient();
const router = express.Router();

// --- 1. INITIAL REGISTRATION ---
router.post('/register', async (req, res) => {
    try {
        const { email, name, password, role, tier } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        let user;

        if (role === 'PUBLIC') {
            user = await prisma.publicUser.create({
                data: { email, name, password: hashedPassword }
            });
            // Public users can activate immediately
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            await prisma.oTP.create({ data: { email, code: otpCode, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
            await sendOtpEmail(email, otpCode, "Activate Your Account");
            return res.status(201).json({ message: "Registration successful! Please check your email to activate your account." });
        } else {
            // Industries and Verifiers require admin approval
            if (role === 'INDUSTRY') {
                user = await prisma.industry.create({ data: { email, name, password: hashedPassword, tier } });
            } else if (role === 'VERIFIER') {
                user = await prisma.verifier.create({ data: { email, name, password: hashedPassword } });
            } else {
                return res.status(400).json({ error: "Invalid role." });
            }
            return res.status(201).json({ message: "Registration successful! Your account is pending admin approval." });
        }
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: "Email already exists." });
        res.status(500).json({ error: "Registration failed." });
    }
});

// --- 2. ACCOUNT ACTIVATION (After Admin Approval or for Public Users) ---
router.post('/activate', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const otpEntry = await prisma.oTP.findFirst({ where: { email, code: otp, expiresAt: { gt: new Date() } } });

        if (!otpEntry) return res.status(400).json({ error: "Invalid or expired OTP." });

        // Find the user across all tables and activate them
        let user = await prisma.industry.findUnique({ where: { email } }) ||
                   await prisma.verifier.findUnique({ where: { email } }) ||
                   await prisma.publicUser.findUnique({ where: { email } });

        if (!user) return res.status(404).json({ error: "User not found." });

        // Activate the correct user type
        const modelName = user.hasOwnProperty('tier') ? 'industry' : (user.status ? 'verifier' : 'publicUser');
        await prisma[modelName].update({
            where: { email },
            data: { isActive: true }
        });

        await prisma.oTP.delete({ where: { id: otpEntry.id } });
        res.status(200).json({ message: "Account activated successfully! You can now log in." });
    } catch (error) {
        res.status(500).json({ error: "Account activation failed." });
    }
});

// --- 3. LOGIN (Request OTP) ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        // Find the user in any of the tables
        let user = await prisma.industry.findUnique({ where: { email } }) ||
                   await prisma.verifier.findUnique({ where: { email } }) ||
                   await prisma.publicUser.findUnique({ where: { email } });

        // Check if user exists and is active/approved
        if (!user || !user.isActive || (user.status && user.status !== 'APPROVED')) {
            return res.status(401).json({ error: "Invalid credentials or account not approved/active." });
        }

        // Check if the provided password is correct
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        // If password is valid, send OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await prisma.oTP.create({ data: { email, code: otpCode, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
        await sendOtpEmail(email, otpCode, "Your Login Verification Code");

        res.status(200).json({ message: "Password verified. Please check your email for an OTP to complete your login." });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed." });
    }
});

// --- 4. VERIFY LOGIN OTP ---
router.post('/verify-login', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const otpEntry = await prisma.oTP.findFirst({ where: { email, code: otp, expiresAt: { gt: new Date() } } });

        if (!otpEntry) {
            return res.status(400).json({ error: "Invalid or expired OTP." });
        }
        
        // Find the user in any of the tables
        let user = await prisma.industry.findUnique({ where: { email } }) ||
                   await prisma.verifier.findUnique({ where: { email } }) ||
                   await prisma.publicUser.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: "User not found after OTP verification." });
        }
        
        // --- THIS IS THE FIX ---
        // Create the token using the user's actual role from the database
        const token = jwt.sign(
            { userId: user.id, role: user.role }, // Use user.role directly
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        // --- END OF FIX ---

        await prisma.oTP.delete({ where: { id: otpEntry.id } });
        delete user.password;
        res.status(200).json({ message: "Login successful!", token, user });

    } catch (error) {
        console.error("Login verification error:", error);
        res.status(500).json({ error: "Login verification failed." });
    }
});
module.exports = router;
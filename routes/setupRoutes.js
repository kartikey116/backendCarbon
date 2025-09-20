// In routes/setupRoutes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @notice POST /api/setup/initial-admin
 * @dev    Creates the first admin user. Can only be run once.
 * @dev    Requires a secret key from the .env file.
 */
router.post('/initial-admin', async (req, res) => {
    try {
        const { email, password, secret } = req.body;

        // 1. Check the secret key
        if (secret !== process.env.ADMIN_SETUP_SECRET) {
            return res.status(403).json({ error: "Invalid secret key." });
        }

        // 2. Check if an admin already exists to prevent this from being run twice
        const adminCount = await prisma.verifier.count({ where: { role: 'ADMIN' }});
        if (adminCount > 0) {
            return res.status(400).json({ error: "An admin account already exists." });
        }

        // 3. Create the admin user
        const hashedPassword = await bcrypt.hash(password, 10);
        const adminUser = await prisma.verifier.create({
            data: {
                email,
                name: "System Admin",
                password: hashedPassword,
                role: 'ADMIN',
                status: 'APPROVED',
                isActive: true // Admin is active immediately
            }
        });

        delete adminUser.password;
        res.status(201).json({ message: "Admin user created successfully!", user: adminUser });

    } catch (error) {
        console.error("Admin setup error:", error);
        res.status(500).json({ error: "Failed to create admin user." });
    }
});

module.exports = router;
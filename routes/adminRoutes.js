// In routes/adminRoutes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { sendOtpEmail } = require('../services/emailService');
const authMiddleware = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminmiddleware');

const prisma = new PrismaClient();
const router = express.Router();

router.post('/approve-user/:userId', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        // Find user in either Industry or Verifier table
        let user = await prisma.industry.findUnique({ where: { id: parseInt(userId) }}) ||
                   await prisma.verifier.findUnique({ where: { id: parseInt(userId) }});
        
        if (!user) return res.status(404).json({ error: "User to approve not found." });

        // Update the correct model
        const modelName = user.hasOwnProperty('tier') ? 'industry' : 'verifier';
        const updatedUser = await prisma[modelName].update({
            where: { id: parseInt(userId) },
            data: { status: "APPROVED" }
        });

        // Send activation OTP upon approval
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await prisma.oTP.create({ data: { email: updatedUser.email, code: otpCode, expiresAt: new Date(Date.now() + 10 * 60 * 1000) }});
        await sendOtpEmail(updatedUser.email, otpCode, "Your Account Has Been Approved!");

        res.status(200).json({ message: `User ${updatedUser.name} has been approved. Activation email sent.` });

    } catch (error) {
        res.status(500).json({ error: "Failed to approve user." });
    }
});

router.post('/tasks', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { industryId, verifierId, dueDate } = req.body;
        const newTask = await prisma.verificationTask.create({
            data: {
                industryId: parseInt(industryId),
                verifierId: parseInt(verifierId),
                dueDate: new Date(dueDate),
                status: "ASSIGNED",
            }
        });
        res.status(201).json(newTask);
    } catch (error) {
        res.status(500).json({ error: "Failed to create task." });
    }
});


// In routes/adminRoutes.js
// ... (your existing imports and routes)

/**
 * @notice POST /api/admin/tasks/:taskId/approve-and-mint
 * @dev    PROTECTED: Admin only. Approves a completed task and mints the carbon credit NFT.
 * @body   { "tokenURI": "ipfs://your_metadata_hash_for_token" }
 */
router.post('/tasks/:taskId/approve-and-mint', authMiddleware, isAdmin, async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);
        const { tokenURI } = req.body;


        const task = await req.prisma.verificationTask.findUnique({
            where: { id: taskId },
            include: { industry: true }, 
        });

        if (!task) {
            return res.status(404).json({ error: "Task not found." });
        }
        if (task.status !== "COMPLETED") {
            return res.status(400).json({ error: "Task must be in 'COMPLETED' status to be approved." });
        }
        if (!task.industry.walletAddress || !task.industry.projectId) {
            return res.status(400).json({ error: "Industry is missing a wallet address or project ID." });
        }
        
        console.log(`Minting credit for project ${task.industry.projectId} to ${task.industry.walletAddress}...`);

        const tx = await req.contract.mintCredit(
            task.industry.projectId,
            task.industry.walletAddress,
            tokenURI
        );
        const receipt = await tx.wait(); 
        
        console.log(`Minting successful! Transaction Hash: ${receipt.hash}`);

        const event = receipt.logs.find(log => log.eventName === 'CreditMinted');
        const tokenId = event ? Number(event.args.tokenId) : null;

        const approvedTask = await req.prisma.verificationTask.update({
            where: { id: taskId },
            data: {
                status: "APPROVED_AND_MINTED",
                transactionHash: receipt.hash,
                tokenId: tokenId,
            },
        });

        res.status(200).json({ message: "Task approved and credit minted successfully!", task: approvedTask });

    } catch (error) {
        console.error("Failed to approve and mint:", error);
        res.status(500).json({ error: "An error occurred during the approval and minting process." });
    }
});

module.exports = router;
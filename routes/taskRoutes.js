const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authmiddleware');

// --- Imports for Cloud Storage (Backblaze B2 / AWS S3) ---
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const prisma = new PrismaClient();
const router = express.Router();

// --- B2/S3 Client Configuration ---
const s3Client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
});

/**
 * @notice GET /api/tasks/my-tasks
 * @dev    PROTECTED: Fetches tasks assigned to the logged-in verifier.
 */
router.get('/my-tasks', authMiddleware, async (req, res) => {
    try {
        const verifierId = req.user.userId;
        const tasks = await prisma.verificationTask.findMany({
            where: { verifierId: verifierId, status: "ASSIGNED" },
            include: { industry: { select: { name: true } } }
        });
        res.json(tasks);
    } catch (error) {
        console.error("Failed to fetch tasks:", error);
        res.status(500).json({ error: "Failed to fetch tasks." });
    }
});

/**
 * @notice POST /api/tasks/:taskId/generate-upload-url
 * @dev    Generates a secure, one-time URL for the mobile app to upload a file to cloud storage.
 * @body   { "fileName": "drone-footage.mp4", "fileType": "video/mp4" }
 */
router.post('/:taskId/generate-upload-url', authMiddleware, async (req, res) => {
    try {
        const taskId = req.params.taskId;
        const { fileName, fileType } = req.body;
        
        // Create a unique key (path) for the file in your bucket
        const fileKey = `evidence/${taskId}/${Date.now()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: fileKey,
            ContentType: fileType,
        });

        // Generate the presigned URL which is valid for a short time (e.g., 10 minutes)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });

        // Return the URL and the final key to the mobile app
        res.json({ uploadUrl, fileKey });

    } catch (error) {
        console.error("Failed to generate upload URL:", error);
        res.status(500).json({ error: "Failed to generate upload URL." });
    }
});


/**
 * @notice POST /api/tasks/:taskId/submit
 * @dev    PROTECTED: Confirms the file upload and saves the file key to the database.
 * @body   { "evidenceKeys": ["evidence/1/167...-drone.mp4"] }
 */
router.post('/:taskId/submit', authMiddleware, async (req, res) => {
    try {
        const taskId = parseInt(req.params.taskId);
        const { evidenceKeys } = req.body; // The app sends the fileKey(s) after uploading
        const verifierId = req.user.userId;

        const task = await prisma.verificationTask.findUnique({
            where: { id: taskId }
        });

        if (!task || task.verifierId !== verifierId) {
            return res.status(403).json({ error: "Forbidden: You are not assigned to this task." });
        }

        const updatedTask = await prisma.verificationTask.update({
            where: { id: taskId },
            data: {
                status: "COMPLETED",
                evidenceLinks: evidenceKeys, // Save the keys/paths to the files in S3/B2
            }
        });
        res.json({ message: "Task report submitted successfully.", task: updatedTask });
    } catch (error) {
        console.error("Failed to submit report:", error);
        res.status(500).json({ error: "Failed to submit report." });
    }
});

module.exports = router;
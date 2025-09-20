// In server.js

// --- 1. IMPORTS ---
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');
require('dotenv').config();

// Local Imports
const contractAbi = require('./abi.js'); // Added the missing ABI import
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const setupRoutes = require('./routes/setupRoutes');
const taskRoutes = require('./routes/taskRoutes');

// --- 2. INITIALIZATIONS ---
const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

// --- 3. BLOCKCHAIN CONNECTION ---
const contractAddress = process.env.SEPOLIA_CONTRACT_ADDRESS;
const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
const rpcUrl = process.env.SEPOLIA_RPC_URL;

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);
const blueCarbonRegistry = new ethers.Contract(contractAddress, contractAbi, wallet);

console.log(`✅ Connected to smart contract at ${contractAddress}`);

// --- 4. MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Custom middleware to make Prisma and the contract instance available to all routes
app.use((req, res, next) => {
    req.prisma = prisma;
    req.contract = blueCarbonRegistry;
    next();
});

// --- 5. API ROUTES ---
app.get('/', (req, res) => {
  res.send('Blue Carbon Registry Backend is running!');
});

app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/tasks', taskRoutes);

// --- 6. SERVER START ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
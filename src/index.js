import express from 'express';
import aiService from './services/aiService.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Single endpoint to query all AI platforms
app.post('/query', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    console.log(`Processing question: ${question}`);
    
    const results = await aiService.queryAllPlatforms(question);
    
    return res.status(200).json({ results });
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ error: 'Failed to process query' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Send POST requests to /query with a "question" property in the JSON body');
}); 
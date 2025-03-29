import readline from 'readline';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const API_URL = `http://localhost:${process.env.PORT || 3000}/query`;

async function queryAIs(question) {
  try {
    console.log('Sending question to AI platforms...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('\n====== RESULTS ======\n');
    
    data.results.forEach(result => {
      console.log(`\n----- ${result.platform} -----`);
      console.log(result.response);
    });
    
    console.log('\n=====================\n');
  } catch (error) {
    console.error('Error querying AI platforms:', error.message);
  }
}

function askQuestion() {
  rl.question('\nEnter your question (or "exit" to quit): ', async (question) => {
    if (question.toLowerCase() === 'exit') {
      rl.close();
      return;
    }
    
    await queryAIs(question);
    askQuestion();
  });
}

console.log('AI Integrator Client');
console.log('===================');
console.log('This will send your question to Claude, OpenAI, and Gemini simultaneously.');
askQuestion(); 
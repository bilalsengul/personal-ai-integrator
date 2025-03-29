import readline from 'readline';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import colors from 'colors/safe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const API_URL = `http://localhost:${process.env.PORT || 3000}/query`;

// Function to format responses for better readability
function formatResponse(response) {
  const lines = response.split('\n');
  const formattedLines = lines.map(line => {
    // Highlight code blocks
    if (line.trim().startsWith('```')) {
      return colors.cyan(line);
    }
    
    // Highlight headings
    if (line.trim().startsWith('#')) {
      return colors.bold(colors.yellow(line));
    }
    
    // Highlight bullet points
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      return colors.green(line);
    }
    
    return line;
  });
  
  return formattedLines.join('\n');
}

function displayDifferences(results) {
  console.log('\n' + colors.bold(colors.blue('===== KEY DIFFERENCES BETWEEN RESPONSES =====')));
  
  // Check response lengths
  const lengthInfo = results.map(r => ({
    platform: r.platform,
    length: r.response.length,
    wordCount: r.response.split(/\s+/).length
  }));
  
  // Sort by length
  lengthInfo.sort((a, b) => b.wordCount - a.wordCount);
  
  console.log(colors.bold('\nResponse Length Comparison:'));
  lengthInfo.forEach(info => {
    console.log(`${info.platform}: ${info.wordCount} words (${info.length} characters)`);
  });
  
  // Check for code examples
  const codeExamples = results.map(r => ({
    platform: r.platform,
    hasCode: r.response.includes('```'),
    codeCount: (r.response.match(/```/g) || []).length / 2
  }));
  
  console.log(colors.bold('\nCode Examples:'));
  codeExamples.forEach(info => {
    console.log(`${info.platform}: ${info.hasCode ? `${info.codeCount} code blocks` : 'No code blocks'}`);
  });
  
  console.log('\n' + colors.blue('================================================') + '\n');
}

async function queryAIs(question) {
  try {
    console.log(colors.cyan('\nSending question to AI platforms...'));
    console.log(colors.dim('This may take a minute or two depending on AI response times.'));
    
    // Display spinner animation
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const spinner = setInterval(() => {
      process.stdout.write(`\r${spinnerChars[i]} Waiting for responses...`);
      i = (i + 1) % spinnerChars.length;
    }, 100);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });
    
    clearInterval(spinner);
    process.stdout.write('\r                              \r');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(colors.bold(colors.magenta('\n====== RESULTS ======\n')));
    
    data.results.forEach(result => {
      console.log(colors.bold(colors.yellow(`\n----- ${result.platform} -----`)));
      console.log(formatResponse(result.response));
      console.log(colors.dim(`\n(${result.response.split(/\s+/).length} words)`));
    });
    
    // Show differences between responses
    displayDifferences(data.results);
    
    // Store latest results in memory for comparison
    global.latestResults = data.results;
    
  } catch (error) {
    console.error(colors.red('Error querying AI platforms:'), error.message);
  }
}

function compareResponses() {
  if (!global.latestResults || global.latestResults.length === 0) {
    console.log(colors.yellow('No responses to compare. Please ask a question first.'));
    return;
  }
  
  displayDifferences(global.latestResults);
}

function showHelp() {
  console.log(colors.bold(colors.green('\nAvailable Commands:')));
  console.log('  ' + colors.cyan('ask <question>') + ' - Ask all AI platforms a question');
  console.log('  ' + colors.cyan('compare') + ' - Compare differences between last responses');
  console.log('  ' + colors.cyan('clear') + ' - Clear the screen');
  console.log('  ' + colors.cyan('help') + ' - Show this help message');
  console.log('  ' + colors.cyan('exit') + ' - Exit the program');
}

function askQuestion() {
  rl.question(colors.green('\n> '), async (input) => {
    const trimmedInput = input.trim();
    
    if (trimmedInput.toLowerCase() === 'exit') {
      rl.close();
      return;
    }
    
    if (trimmedInput.toLowerCase() === 'help') {
      showHelp();
      askQuestion();
      return;
    }
    
    if (trimmedInput.toLowerCase() === 'clear') {
      console.clear();
      askQuestion();
      return;
    }
    
    if (trimmedInput.toLowerCase() === 'compare') {
      compareResponses();
      askQuestion();
      return;
    }
    
    if (trimmedInput.toLowerCase().startsWith('ask ')) {
      const question = trimmedInput.substring(4).trim();
      if (question) {
        await queryAIs(question);
      } else {
        console.log(colors.red('Please provide a question after "ask"'));
      }
      askQuestion();
      return;
    }
    
    // Default behavior: if input doesn't match a command, treat it as a question
    if (trimmedInput) {
      await queryAIs(trimmedInput);
    }
    
    askQuestion();
  });
}

// Clear screen and show welcome message
console.clear();
console.log(colors.bold(colors.rainbow('=== AI Integrator Client ===')));
console.log(colors.bold('Version 2.0'));
console.log('\nThis will send your question to Claude, OpenAI, and Gemini simultaneously.');
console.log('Type ' + colors.cyan('help') + ' for available commands.\n');

// Initialize global variables
global.latestResults = [];

// Start the interactive prompt
askQuestion(); 
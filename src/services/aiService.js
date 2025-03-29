import { chromium } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

class AiService {
  constructor() {
    this.browser = null;
    this.userDataDir = path.join(__dirname, '../../browserData');
  }

  async initialize() {
    this.browser = await chromium.launchPersistentContext(this.userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      deviceScaleFactor: 2,
      bypassCSP: true,
      ignoreHTTPSErrors: true,
      args: ['--disable-blink-features=AutomationControlled'],
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async loginWithGoogle(page) {
    try {
      console.log('Attempting Google login. You may need to manually complete this once...');
      
      // Fill in Google email
      await page.fill('input[type="email"]', process.env.GOOGLE_EMAIL);
      await page.click('button:has-text("Next")');
      
      // Wait a bit longer for the password field 
      try {
        await page.waitForSelector('input[type="password"]', { timeout: 5000 });
        await page.fill('input[type="password"]', process.env.GOOGLE_PASSWORD);
        await page.click('button:has-text("Next")');
      } catch (err) {
        console.log('Password field not found automatically. You may need to enter manually.');
        // Wait longer for manual intervention
        await page.waitForNavigation({ timeout: 60000 });
      }
      
      return true;
    } catch (error) {
      console.error('Error during Google login:', error);
      console.log('Please complete the login manually. Waiting 60 seconds...');
      await page.waitForNavigation({ timeout: 60000 });
      return true; // Return true anyway as we'll wait for manual intervention
    }
  }

  async queryClaude(question) {
    try {
      const page = await this.browser.newPage();
      
      // Navigate to Claude
      await page.goto('https://claude.ai');
      
      // Check if we need to log in
      if (await page.$('button:has-text("Sign in"), a:has-text("Sign in"), button:has-text("Login"), a:has-text("Login")')) {
        console.log('Login required for Claude');
        await page.click('button:has-text("Sign in"), a:has-text("Sign in"), button:has-text("Login"), a:has-text("Login")');
        
        if (await page.$('button:has-text("Continue with Google"), a:has-text("Continue with Google")')) {
          await page.click('button:has-text("Continue with Google"), a:has-text("Continue with Google")');
          
          try {
            // Wait for potential popup
            const popupPromise = page.waitForEvent('popup', { timeout: 5000 });
            const popup = await popupPromise;
            await this.loginWithGoogle(popup);
          } catch (err) {
            // No popup, try to login in the same page
            await this.loginWithGoogle(page);
          }
        }
        
        // Wait for login to complete
        await page.waitForNavigation({ timeout: 60000, waitUntil: 'networkidle' });
      }
      
      // Check if we're already on a chat page or need to create new chat
      if (await page.$('button:has-text("New Chat")')) {
        await page.click('button:has-text("New Chat")');
      }
      
      // Type and submit question
      await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });
      await page.fill('div[contenteditable="true"]', question);
      await page.keyboard.press('Enter');
      
      // Wait for response to complete
      await page.waitForSelector('div[data-message-author="assistant"]:last-child', { state: 'visible', timeout: 60000 });
      
      // Extract the response
      const responseElement = await page.locator('div[data-message-author="assistant"]:last-child');
      const response = await responseElement.textContent();
      
      await page.close();
      return { platform: 'Claude', response: response.trim() };
    } catch (error) {
      console.error('Error with Claude:', error);
      return { platform: 'Claude', response: 'Error: Could not get response from Claude. You may need to login manually first.' };
    }
  }

  async queryOpenAI(question) {
    try {
      const page = await this.browser.newPage();
      
      // Navigate to OpenAI
      await page.goto('https://chat.openai.com');
      
      // Check if we need to log in
      if (await page.$('button:has-text("Log in")')) {
        console.log('Login required for OpenAI');
        await page.click('button:has-text("Log in")');
        
        if (await page.$('button:has-text("Continue with Google")')) {
          await page.click('button:has-text("Continue with Google")');
          await this.loginWithGoogle(page);
        }
        
        // Wait for login to complete
        await page.waitForNavigation({ timeout: 60000, waitUntil: 'networkidle' });
      }
      
      // Check if we need to select a model (o3-mini-high)
      try {
        const modelSelectorButton = await page.$('button:has-text("GPT-")');
        if (modelSelectorButton) {
          await modelSelectorButton.click();
          await page.click('div[role="option"]:has-text("o3-mini-high")');
        }
      } catch (err) {
        console.log('Could not select model, continuing with default');
      }
      
      // Type and submit question
      await page.waitForSelector('div[role="textbox"]', { timeout: 10000 });
      await page.fill('div[role="textbox"]', question);
      await page.keyboard.press('Enter');
      
      // Wait for response
      await page.waitForSelector('div[data-message-author-role="assistant"]:last-child', { state: 'visible', timeout: 60000 });
      
      // Extract the response
      const responseElement = await page.locator('div[data-message-author-role="assistant"]:last-child');
      const response = await responseElement.textContent();
      
      await page.close();
      return { platform: 'OpenAI', response: response.trim() };
    } catch (error) {
      console.error('Error with OpenAI:', error);
      return { platform: 'OpenAI', response: 'Error: Could not get response from OpenAI. You may need to login manually first.' };
    }
  }

  async queryGemini(question) {
    try {
      const page = await this.browser.newPage();
      
      // Navigate to Gemini
      await page.goto('https://gemini.google.com/');
      
      // Check if we need to log in
      if (await page.$('a:has-text("Sign in")')) {
        console.log('Login required for Gemini');
        await page.click('a:has-text("Sign in")');
        await this.loginWithGoogle(page);
        
        // Wait for login to complete
        await page.waitForNavigation({ timeout: 60000, waitUntil: 'networkidle' });
      }
      
      // Check for model selector (assuming Gemini has a model selector)
      try {
        const modelSelector = await page.$('button:has-text("Gemini")');
        if (modelSelector) {
          await modelSelector.click();
          await page.click('div[role="option"]:has-text("2.5")');
        }
      } catch (err) {
        console.log('Could not select model, continuing with default');
      }
      
      // Type and submit question
      await page.waitForSelector('textarea', { timeout: 10000 });
      await page.fill('textarea', question);
      await page.keyboard.press('Enter');
      
      // Wait for response
      await page.waitForSelector('div[role="region"][aria-label*="Response"]', { state: 'visible', timeout: 60000 });
      
      // Extract the response
      const responseElement = await page.locator('div[role="region"][aria-label*="Response"]');
      const response = await responseElement.textContent();
      
      await page.close();
      return { platform: 'Gemini', response: response.trim() };
    } catch (error) {
      console.error('Error with Gemini:', error);
      return { platform: 'Gemini', response: 'Error: Could not get response from Gemini. You may need to login manually first.' };
    }
  }

  async queryAllPlatforms(question) {
    await this.initialize();
    
    // Query all platforms sequentially for more stability
    // This helps with managing the browser resources better
    const claudeResult = await this.queryClaude(question);
    const openaiResult = await this.queryOpenAI(question);
    const geminiResult = await this.queryGemini(question);
    
    await this.close();
    
    return [claudeResult, openaiResult, geminiResult];
  }
}

const aiService = new AiService();
export default aiService; 
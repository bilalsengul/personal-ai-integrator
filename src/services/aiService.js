import { chromium } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

class AiService {
  constructor() {
    this.browser = null;
    this.userDataDir = path.join(__dirname, '../../browserData');
    this.cacheDir = path.join(__dirname, '../../cache');
    this.defaultTimeout = 60000; // Increase default timeout to 60 seconds
    this.retryAttempts = 2;
    this.headless = process.env.HEADLESS === 'true';
    
    // Ensure cache directory exists
    this.initCache();
  }
  
  async initCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.log('Cache directory already exists or could not be created');
    }
  }

  async initialize() {
    this.browser = await chromium.launchPersistentContext(this.userDataDir, {
      headless: this.headless,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      deviceScaleFactor: 2,
      bypassCSP: true,
      ignoreHTTPSErrors: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      recordVideo: process.env.RECORD_VIDEO === 'true' ? {
        dir: path.join(__dirname, '../../videos'),
        size: { width: 1280, height: 800 }
      } : undefined
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async retry(fn, retries = this.retryAttempts) {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      console.log(`Retrying... Attempts remaining: ${retries}`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      return this.retry(fn, retries - 1);
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
        await page.waitForSelector('input[type="password"]', { timeout: this.defaultTimeout });
        await page.fill('input[type="password"]', process.env.GOOGLE_PASSWORD);
        await page.click('button:has-text("Next")');
      } catch (err) {
        console.log('Password field not found automatically. You may need to enter manually.');
        // Wait longer for manual intervention
        await page.waitForNavigation({ timeout: this.defaultTimeout * 2 });
      }
      
      return true;
    } catch (error) {
      console.error('Error during Google login:', error);
      console.log('Please complete the login manually. Waiting 120 seconds...');
      await page.waitForNavigation({ timeout: this.defaultTimeout * 2 });
      return true; // Return true anyway as we'll wait for manual intervention
    }
  }

  async checkCache(question, platform) {
    const cacheFile = path.join(this.cacheDir, `${platform}_${Buffer.from(question).toString('base64').substring(0, 50)}.json`);
    try {
      const data = await fs.readFile(cacheFile, 'utf8');
      const cached = JSON.parse(data);
      if (cached.timestamp && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
        console.log(`Using cached response for ${platform}`);
        return cached.response;
      }
    } catch (error) {
      // Cache miss or error, continue with live query
    }
    return null;
  }

  async saveToCache(question, platform, response) {
    const cacheFile = path.join(this.cacheDir, `${platform}_${Buffer.from(question).toString('base64').substring(0, 50)}.json`);
    try {
      await fs.writeFile(cacheFile, JSON.stringify({
        timestamp: Date.now(),
        response
      }));
    } catch (error) {
      console.error(`Error saving to cache: ${error.message}`);
    }
  }

  async takeScreenshot(page, name) {
    try {
      const screenshotDir = path.join(__dirname, '../../screenshots');
      await fs.mkdir(screenshotDir, { recursive: true });
      await page.screenshot({ 
        path: path.join(screenshotDir, `${name}_${Date.now()}.png`),
        fullPage: true 
      });
      console.log(`Saved screenshot for ${name}`);
    } catch (error) {
      console.error(`Failed to take screenshot: ${error.message}`);
    }
  }

  async queryClaude(question) {
    // Check cache first
    const cached = await this.checkCache(question, 'Claude');
    if (cached) return { platform: 'Claude', response: cached };

    try {
      const page = await this.browser.newPage();
      
      // Navigate to Claude
      await page.goto('https://claude.ai', { timeout: this.defaultTimeout });
      
      // Take screenshot for debugging
      await this.takeScreenshot(page, 'claude_initial');
      
      // Check if we need to log in
      const loginButton = await page.$('button:has-text("Sign in"), a:has-text("Sign in"), button:has-text("Login"), a:has-text("Login")');
      if (loginButton) {
        console.log('Login required for Claude');
        await loginButton.click();
        
        await this.takeScreenshot(page, 'claude_login');
        
        const googleButton = await page.$('button:has-text("Continue with Google"), a:has-text("Continue with Google")');
        if (googleButton) {
          await googleButton.click();
          
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
        await page.waitForNavigation({ timeout: this.defaultTimeout, waitUntil: 'networkidle' });
      }
      
      // Take screenshot after login
      await this.takeScreenshot(page, 'claude_post_login');
      
      // Check if we're already on a chat page or need to create new chat
      const newChatButton = await page.$('button:has-text("New Chat")');
      if (newChatButton) {
        await newChatButton.click();
      }
      
      // Type and submit question - using retry for reliability
      await this.retry(async () => {
        await page.waitForSelector('div[contenteditable="true"]', { timeout: this.defaultTimeout });
        await page.fill('div[contenteditable="true"]', question);
        await page.keyboard.press('Enter');
      });
      
      // Wait for response to complete
      await page.waitForSelector('div[data-message-author="assistant"]:last-child', { 
        state: 'visible', 
        timeout: this.defaultTimeout * 2 
      });
      
      // Take screenshot of response
      await this.takeScreenshot(page, 'claude_response');
      
      // Extract the response
      const responseElement = await page.locator('div[data-message-author="assistant"]:last-child');
      const response = await responseElement.textContent();
      
      await page.close();
      
      const result = response.trim();
      // Cache the result
      await this.saveToCache(question, 'Claude', result);
      
      return { platform: 'Claude', response: result };
    } catch (error) {
      console.error('Error with Claude:', error);
      return { platform: 'Claude', response: 'Error: Could not get response from Claude. You may need to login manually first.' };
    }
  }

  async queryOpenAI(question) {
    // Check cache first
    const cached = await this.checkCache(question, 'OpenAI');
    if (cached) return { platform: 'OpenAI', response: cached };
    
    try {
      const page = await this.browser.newPage();
      
      // Navigate to OpenAI
      await page.goto('https://chat.openai.com', { timeout: this.defaultTimeout });
      
      // Take screenshot for debugging
      await this.takeScreenshot(page, 'openai_initial');
      
      // Check if we need to log in
      const loginButton = await page.$('button:has-text("Log in")');
      if (loginButton) {
        console.log('Login required for OpenAI');
        await loginButton.click();
        
        await this.takeScreenshot(page, 'openai_login');
        
        const googleButton = await page.$('button:has-text("Continue with Google")');
        if (googleButton) {
          await googleButton.click();
          await this.loginWithGoogle(page);
        }
        
        // Wait for login to complete
        await page.waitForNavigation({ timeout: this.defaultTimeout, waitUntil: 'networkidle' });
      }
      
      // Take screenshot after login
      await this.takeScreenshot(page, 'openai_post_login');
      
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
      
      // Type and submit question - using retry for reliability
      await this.retry(async () => {
        await page.waitForSelector('div[role="textbox"]', { timeout: this.defaultTimeout });
        await page.fill('div[role="textbox"]', question);
        await page.keyboard.press('Enter');
      });
      
      // Wait for response
      await page.waitForSelector('div[data-message-author-role="assistant"]:last-child', { 
        state: 'visible', 
        timeout: this.defaultTimeout * 2
      });
      
      // Take screenshot of response
      await this.takeScreenshot(page, 'openai_response');
      
      // Extract the response
      const responseElement = await page.locator('div[data-message-author-role="assistant"]:last-child');
      const response = await responseElement.textContent();
      
      await page.close();
      
      const result = response.trim();
      // Cache the result
      await this.saveToCache(question, 'OpenAI', result);
      
      return { platform: 'OpenAI', response: result };
    } catch (error) {
      console.error('Error with OpenAI:', error);
      return { platform: 'OpenAI', response: 'Error: Could not get response from OpenAI. You may need to login manually first.' };
    }
  }

  async queryGemini(question) {
    // Check cache first
    const cached = await this.checkCache(question, 'Gemini');
    if (cached) return { platform: 'Gemini', response: cached };
    
    try {
      const page = await this.browser.newPage();
      
      // Navigate to Gemini
      await page.goto('https://gemini.google.com/', { timeout: this.defaultTimeout });
      
      // Take screenshot for debugging
      await this.takeScreenshot(page, 'gemini_initial');
      
      // Check if we need to log in
      const signInButton = await page.$('a:has-text("Sign in")');
      if (signInButton) {
        console.log('Login required for Gemini');
        await signInButton.click();
        
        await this.takeScreenshot(page, 'gemini_login');
        
        await this.loginWithGoogle(page);
        
        // Wait for login to complete
        await page.waitForNavigation({ timeout: this.defaultTimeout, waitUntil: 'networkidle' });
      }
      
      // Take screenshot after login
      await this.takeScreenshot(page, 'gemini_post_login');
      
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
      
      // Type and submit question - using retry for reliability
      await this.retry(async () => {
        await page.waitForSelector('textarea', { timeout: this.defaultTimeout });
        await page.fill('textarea', question);
        await page.keyboard.press('Enter');
      });
      
      // Wait for response
      await page.waitForSelector('div[role="region"][aria-label*="Response"]', { 
        state: 'visible', 
        timeout: this.defaultTimeout * 2
      });
      
      // Take screenshot of response
      await this.takeScreenshot(page, 'gemini_response');
      
      // Extract the response
      const responseElement = await page.locator('div[role="region"][aria-label*="Response"]');
      const response = await responseElement.textContent();
      
      await page.close();
      
      const result = response.trim();
      // Cache the result
      await this.saveToCache(question, 'Gemini', result);
      
      return { platform: 'Gemini', response: result };
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
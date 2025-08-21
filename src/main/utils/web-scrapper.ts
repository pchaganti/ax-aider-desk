import { BrowserWindow } from 'electron';
import Turndown from 'turndown';
import * as cheerio from 'cheerio';

export class WebScraper {
  private window: BrowserWindow | null = null;

  async scrape(url: string, timeout: number = 60000): Promise<string> {
    return await this.scrapeWithBrowserWindow(url, timeout);
  }

  private async scrapeWithBrowserWindow(url: string, timeout: number = 60000): Promise<string> {
    // Create hidden BrowserWindow for scraping
    this.window = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
      },
    });

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Scraping timeout after ${timeout}ms`)), timeout);
      });

      // Load the URL with timeout
      await Promise.race([this.window.loadURL(url), timeoutPromise]);

      // Wait for page to load completely with timeout
      await Promise.race([this.waitForPageLoad(), timeoutPromise]);

      // Get page content with timeout
      const content = await Promise.race([
        this.window.webContents.executeJavaScript(`
          document.documentElement.outerHTML;
        `),
        timeoutPromise,
      ]);

      // Get content type from headers with timeout
      const contentType = await Promise.race([this.getContentType(), timeoutPromise]);

      // If it's HTML, convert to markdown-like text
      if (contentType.includes('text/html') || this.looksLikeHTML(content)) {
        return this.htmlToMarkDown(content);
      }

      return content;
    } finally {
      // Cleanup window
      await this.cleanupWindow();
    }
  }

  private async waitForPageLoad(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.window) {
        return resolve();
      }

      const checkLoadState = () => {
        if (this.window!.webContents.isLoading()) {
          setTimeout(checkLoadState, 100);
        } else {
          // Additional wait for dynamic content to load
          setTimeout(resolve, 1000);
        }
      };

      checkLoadState();
    });
  }

  private async getContentType(): Promise<string> {
    if (!this.window) {
      return '';
    }

    try {
      const contentType = await this.window.webContents.executeJavaScript(`
        (() => {
          const xhr = new XMLHttpRequest();
          xhr.open('HEAD', window.location.href, false);
          xhr.send();
          return xhr.getResponseHeader('content-type') || '';
        })()
      `);
      return contentType;
    } catch {
      return '';
    }
  }

  private async cleanupWindow(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
    this.window = null;
  }

  private looksLikeHTML(content: string): boolean {
    const htmlPatterns = [/<!DOCTYPE\s+html/i, /<html/i, /<head/i, /<body/i, /<div/i, /<p>/i, /<a\s+href=/i];

    return htmlPatterns.some((pattern) => pattern.test(content));
  }

  private cleanHtml(content: string): string {
    const $ = cheerio.load(content);

    $('script, style, link, noscript, iframe, svg, meta, img, video, audio, canvas, form, button, input, select, textarea').remove();

    // Remove comments
    $('*')
      .contents()
      .filter((_, node) => node.type === 'comment')
      .remove();

    return $.html();
  }

  private htmlToMarkDown(content: string): string {
    const cleanedHtml = this.cleanHtml(content);
    const turndownService = new Turndown();

    return turndownService.turndown(cleanedHtml);
  }
}

export const scrapeWeb = async (url: string, timeout: number = 60000) => {
  const scraper = new WebScraper();
  return await scraper.scrape(url, timeout);
};

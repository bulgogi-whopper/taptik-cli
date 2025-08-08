import { Injectable } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Controller, Get, Module, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';

@Controller()
class CallbackController {
  private readonly logger = new Logger(CallbackController.name);
  private callbackData: any = null;
  private callbackPromise: {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  } | null = null;

  @Get('/auth/callback')
  async handleCallback(
    @Query() query: any,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log('OAuth callback received with query params:', query);

    // Check if this request has OAuth tokens (query parameters)
    if (query.access_token) {
      // This is the second request with actual OAuth data
      this.callbackData = query;

      // Resolve the waiting promise
      if (this.callbackPromise) {
        this.callbackPromise.resolve(query);
        this.callbackPromise = null;
      }

      // Send final success page
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Taptik CLI - OAuth Complete</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
              }
              .container {
                text-align: center;
                background: rgba(255,255,255,0.1);
                padding: 2rem;
                border-radius: 12px;
                backdrop-filter: blur(10px);
              }
              .success { color: #4ade80; font-size: 3rem; margin-bottom: 1rem; }
              h1 { margin: 0 0 1rem 0; }
              p { margin: 0.5rem 0; opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success">✅</div>
              <h1>Authentication Complete!</h1>
              <p>OAuth authentication was successful.</p>
              <p>You can now close this browser window and return to your terminal.</p>
            </div>
            <script>
              // Auto-close after 2 seconds
              setTimeout(() => {
                window.close();
              }, 2000);
            </script>
          </body>
        </html>
      `);
      return;
    }

    // Send success response to browser
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Taptik CLI - OAuth Complete</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              background: rgba(255,255,255,0.1);
              padding: 2rem;
              border-radius: 12px;
              backdrop-filter: blur(10px);
            }
            .success { color: #4ade80; font-size: 3rem; margin-bottom: 1rem; }
            h1 { margin: 0 0 1rem 0; }
            p { margin: 0.5rem 0; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h1>Authentication Successful!</h1>
            <p>You have successfully authenticated with Taptik CLI.</p>
            <p>You can now close this browser window and return to your terminal.</p>
          </div>
          <script>
            // Extract OAuth data from URL fragments and redirect to query params
            function processOAuthData() {
              const hash = window.location.hash.substring(1);
              if (hash) {
                // Convert fragments to query parameters and redirect
                const newUrl = window.location.origin + window.location.pathname + '?' + hash;
                window.location.replace(newUrl);
                return;
              }
              
              // If no fragments, auto-close after 3 seconds
              setTimeout(() => {
                window.close();
              }, 3000);
            }
            
            // Process OAuth data immediately
            processOAuthData();
          </script>
        </body>
      </html>
    `);
  }

  // Method to wait for callback
  waitForCallback(): Promise<any> {
    return new Promise((resolve, reject) => {
      // If we already have callback data, resolve immediately
      if (this.callbackData) {
        const data = this.callbackData;
        this.callbackData = null;
        resolve(data);
        return;
      }

      // Store the promise resolvers
      this.callbackPromise = { resolve, reject };

      // Set timeout to reject after 2 minutes
      setTimeout(() => {
        if (this.callbackPromise) {
          this.callbackPromise.reject(new Error('OAuth callback timeout'));
          this.callbackPromise = null;
        }
      }, 120000); // 2 minutes
    });
  }

  // Reset state
  reset(): void {
    this.callbackData = null;
    if (this.callbackPromise) {
      this.callbackPromise.reject(new Error('OAuth callback cancelled'));
      this.callbackPromise = null;
    }
  }
}

@Module({
  controllers: [CallbackController],
})
class CallbackModule {}

@Injectable()
export class OAuthCallbackServer {
  private readonly logger = new Logger(OAuthCallbackServer.name);
  private app: any = null;
  private server: any = null;
  private controller: CallbackController | null = null;

  /**
   * Start the OAuth callback server on specified port
   */
  async start(port: number = 54321): Promise<string> {
    try {
      this.logger.log(`Starting OAuth callback server on port ${port}...`);

      // Create NestJS application
      this.app = await NestFactory.create(CallbackModule, {
        logger: false, // Disable logging for cleaner output
      });

      // Enable CORS for browser requests
      this.app.enableCors({
        origin: true,
        credentials: true,
      });

      // Get controller instance to access methods
      this.controller = this.app.get(CallbackController);

      // Start the server
      this.server = await this.app.listen(port);

      const callbackUrl = `http://localhost:${port}/auth/callback`;
      this.logger.log(`OAuth callback server started at: ${callbackUrl}`);

      return callbackUrl;
    } catch (error) {
      this.logger.error('Failed to start OAuth callback server', error);
      throw new Error(
        `Failed to start callback server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Wait for OAuth callback to be received
   */
  async waitForCallback(): Promise<any> {
    if (!this.controller) {
      throw new Error('Callback server not started');
    }

    return this.controller.waitForCallback();
  }

  /**
   * Stop the OAuth callback server
   */
  async stop(): Promise<void> {
    try {
      if (this.controller) {
        this.controller.reset();
      }

      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server.close((error: any) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
        this.server = null;
      }

      if (this.app) {
        await this.app.close();
        this.app = null;
      }

      this.controller = null;
      this.logger.log('OAuth callback server stopped');
    } catch (error) {
      this.logger.error('Error stopping OAuth callback server', error);
      throw error;
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null && this.app !== null;
  }
}

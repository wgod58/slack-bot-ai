import 'dotenv/config';
import express, { Express } from 'express';

import router from './routes/router';
import { ServiceFactory } from './factories/ServiceFactory';

export class App {
  private server: Express;
  private serviceFactory: ServiceFactory;

  constructor() {
    this.server = express();
    this.serviceFactory = ServiceFactory.getInstance();
    // Setup basic middleware
    this.server.use(express.json());
  }

  async initialize(): Promise<App> {
    try {
      this.server.use('/api', router);

      // Initialize all services
      await this.serviceFactory.initializeServices();

      return this;
    } catch (error) {
      console.log('Error starting server:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const PORT = process.env.PORT || 3000;
      this.server.listen(PORT, (error?: Error) => {
        if (error) {
          console.log('Error starting server:', error);
          reject(error);
          return;
        }
        console.log(`Server is running on port ${PORT}`);
        resolve();
      });
    });
  }

  // Optional cleanup method that can be set by tests
  onShutdown: (() => Promise<void>) | null = null;
}

const app = new App();

// Start the server if this file is run directly
app.initialize().then(() => app.start());

export default app;

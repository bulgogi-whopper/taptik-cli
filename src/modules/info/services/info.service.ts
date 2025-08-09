import { Injectable } from '@nestjs/common';

/**
 * Service for handling interactive user input during the build process
 */
@Injectable()
export class InfoService {
  // FIXME: 
  async getAccountInfo() {
    return {
      email: 'test@taptik.ai',
      loggedInAt: new Date()
    }
  }
  
}
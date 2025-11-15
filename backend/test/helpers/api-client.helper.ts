import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

/**
 * API client helper for making authenticated requests in e2e tests
 */
export class ApiClient {
  constructor(
    private readonly app: INestApplication,
    private readonly authToken?: string,
  ) {}

  /**
   * Make a GET request
   */
  async get(path: string, query?: Record<string, any>) {
    const req = request(this.app.getHttpServer()).get(path);

    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }

    if (query) {
      req.query(query);
    }

    return req;
  }

  /**
   * Make a POST request
   */
  async post(path: string, body?: any) {
    const req = request(this.app.getHttpServer())
      .post(path)
      .send(body);

    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }

    return req;
  }

  /**
   * Make a PUT request
   */
  async put(path: string, body?: any) {
    const req = request(this.app.getHttpServer())
      .put(path)
      .send(body);

    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }

    return req;
  }

  /**
   * Make a DELETE request
   */
  async delete(path: string) {
    const req = request(this.app.getHttpServer()).delete(path);

    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }

    return req;
  }

  /**
   * Create a new client with authentication token
   */
  withAuth(token: string): ApiClient {
    return new ApiClient(this.app, token);
  }
}

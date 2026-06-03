/**
 * HTTP Router for Storage Server
 *
 * Simple pattern-based router for HTTP requests.
 */

import type { IncomingMessage, ServerResponse } from 'http';

export type RequestHandler = (req: IncomingMessage, res: ServerResponse, params?: Record<string, string>) => Promise<void>;

export interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RequestHandler;
}

export class Router {
  private routes: Route[] = [];

  addRoute(method: string, path: string, handler: RequestHandler): void {
    // Convert path pattern like /storage/get/:key to regex
    // :param becomes a named capture group
    const paramNames: string[] = [];
    const regexPattern = path.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    const pattern = new RegExp(`^${regexPattern}$`);

    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      paramNames,
      handler: (req, res, params) => handler(req, res, params as Record<string, string>),
    });
  }

  get(path: string, handler: RequestHandler): void {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: RequestHandler): void {
    this.addRoute('POST', path, handler);
  }

  delete(path: string, handler: RequestHandler): void {
    this.addRoute('DELETE', path, handler);
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const method = req.method?.toUpperCase() ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = url.pathname.match(route.pattern);
      if (match) {
        // Extract named params using stored paramNames
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, index) => {
          params[name] = decodeURIComponent(match[index + 1]);
        });

        await route.handler(req, res, params);
        return true;
      }
    }

    return false; // No route matched
  }
}

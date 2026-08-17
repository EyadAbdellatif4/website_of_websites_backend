import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';

@Injectable()
export class PortManagerService {
  private readonly portStart: number;
  private readonly portEnd: number;
  private readonly allocatedPorts = new Set<number>();

  constructor(private readonly configService: ConfigService) {
    this.portStart = Number(
      this.configService.get<number>('PREVIEW_PORT_START') || 3100,
    );
    this.portEnd = Number(
      this.configService.get<number>('PREVIEW_PORT_END') || 3199,
    );
  }

  /**
   * Finds and claims an available port within the configured preview range
   */
  async allocatePort(): Promise<number> {
    for (let port = this.portStart; port <= this.portEnd; port++) {
      if (!this.allocatedPorts.has(port)) {
        const isFree = await this.isPortAvailable(port);
        if (isFree) {
          this.allocatedPorts.add(port);
          return port;
        }
      }
    }

    throw new InternalServerErrorException(
      `No available preview ports in range ${this.portStart}-${this.portEnd}. Please stop an active preview.`,
    );
  }

  /**
   * Releases an allocated port back to the available pool
   */
  releasePort(port: number): void {
    this.allocatedPorts.delete(port);
  }

  /**
   * Checks if a port is actively in use by probe binding a temporary server socket
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, '127.0.0.1');
    });
  }

  getAllocatedPorts(): number[] {
    return Array.from(this.allocatedPorts);
  }
}

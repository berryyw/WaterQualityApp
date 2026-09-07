import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getServiceInfo() {
    return {
      service: 'SwimService',
      description: '泳池水质通统一后端服务',
      version: '0.1.0',
      docs: {
        architecture: '.trae/documents/泳池水质通服务端技术架构文档.md',
        database: '.trae/documents/泳池水质通服务端数据库与API设计文档.md',
      },
      endpoints: {
        health: '/api/health',
        app: '/api/app/*',
        admin: '/api/admin/*',
      },
    };
  }
}

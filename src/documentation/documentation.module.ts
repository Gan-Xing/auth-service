import { Module } from '@nestjs/common';
import { DocumentationController } from './documentation.controller';

@Module({
  controllers: [DocumentationController],
})
export class DocumentationModule {}
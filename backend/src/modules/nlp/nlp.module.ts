import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';
import { NlpProcessor } from './nlp.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'nlp-processing',
    }),
  ],
  controllers: [NlpController],
  providers: [NlpService, NlpProcessor],
  exports: [NlpService],
})
export class NlpModule {}

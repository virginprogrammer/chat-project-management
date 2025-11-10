import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NlpController } from './nlp.controller';
import { NlpService } from './nlp.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'nlp-processing',
    }),
  ],
  controllers: [NlpController],
  providers: [NlpService],
  exports: [NlpService],
})
export class NlpModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { TranscriptionProcessor } from './transcription.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'transcription',
    }),
  ],
  controllers: [TranscriptionController],
  providers: [TranscriptionService, TranscriptionProcessor],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}

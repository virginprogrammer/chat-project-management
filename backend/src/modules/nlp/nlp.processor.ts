import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { NlpService } from './nlp.service';

@Processor('nlp-processing')
export class NlpProcessor {
  private readonly logger = new Logger(NlpProcessor.name);

  constructor(private nlpService: NlpService) {}

  @Process('process-message')
  async handleMessageProcessing(job: Job) {
    const { messageId } = job.data;

    this.logger.log(`Starting NLP processing for message: ${messageId}`);

    try {
      await job.progress(10);

      const result = await this.nlpService.processMessage(messageId);

      await job.progress(100);

      this.logger.log(`NLP processing completed for message: ${messageId}`);
      return { success: true, messageId, result };
    } catch (error) {
      this.logger.error(`NLP processing failed for message: ${messageId}`, error);
      throw error;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ConcurrencyOptions {
  maxConcurrent?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface TaskResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
  retries: number;
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalTasks: number;
  averageExecutionTime: number;
}

class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number = 1): void {
    const queueElement = { item, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (queueElement.priority > this.items[i].priority) {
        this.items.splice(i, 0, queueElement);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(queueElement);
    }
  }

  dequeue(): T | undefined {
    return this.items.shift()?.item;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

@Injectable()
export class ConcurrencyService {
  private readonly logger = new Logger(ConcurrencyService.name);
  private readonly maxConcurrentDefault: number;
  
  // 任务队列和执行状态
  private taskQueue = new PriorityQueue<() => Promise<any>>();
  private runningTasks = new Set<Promise<any>>();
  private stats = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    totalExecutionTime: 0,
  };

  constructor(private readonly configService: ConfigService) {
    this.maxConcurrentDefault = this.configService.get('performance.maxConcurrentTasks') || 10;
  }

  /**
   * 执行并发任务
   */
  async executeConcurrent<T>(
    tasks: Array<() => Promise<T>>,
    options?: ConcurrencyOptions,
  ): Promise<TaskResult<T>[]> {
    const maxConcurrent = options?.maxConcurrent || this.maxConcurrentDefault;
    const results: TaskResult<T>[] = [];
    
    // 添加任务到队列
    const priorityMap = { low: 1, normal: 2, high: 3 };
    const priority = priorityMap[options?.priority || 'normal'];
    
    for (const task of tasks) {
      this.taskQueue.enqueue(task, priority);
      this.stats.pending++;
    }

    // 并发执行任务
    const workers: Promise<void>[] = [];
    
    for (let i = 0; i < Math.min(maxConcurrent, tasks.length); i++) {
      workers.push(this.worker(results, options));
    }

    await Promise.all(workers);
    
    return results;
  }

  /**
   * 执行单个任务带重试机制
   */
  async executeWithRetry<T>(
    task: () => Promise<T>,
    options?: ConcurrencyOptions,
  ): Promise<TaskResult<T>> {
    const maxRetries = options?.retries || 3;
    const retryDelay = options?.retryDelay || 1000;
    const timeout = options?.timeout || 30000;
    
    let lastError: Error;
    let retries = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      
      try {
        const result = await this.executeWithTimeout(task, timeout);
        const duration = Date.now() - startTime;
        
        this.updateStats(true, duration);
        
        return {
          success: true,
          result,
          duration,
          retries,
        };
      } catch (error) {
        lastError = error;
        retries++;
        
        if (attempt < maxRetries) {
          this.logger.warn(`Task failed, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await this.delay(retryDelay * Math.pow(2, attempt)); // 指数退避
        }
      }
    }

    const duration = Date.now() - Date.now(); // 这里应该记录总时间
    this.updateStats(false, duration);
    
    return {
      success: false,
      error: lastError,
      duration,
      retries,
    };
  }

  /**
   * 批处理任务
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options?: ConcurrencyOptions & { batchSize?: number },
  ): Promise<R[]> {
    const batchSize = options?.batchSize || 100;
    const batches: T[][] = [];
    
    // 分批
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    // 并发处理批次
    const batchTasks = batches.map(batch => () => processor(batch));
    const results = await this.executeConcurrent(batchTasks, options);
    
    // 合并结果
    const flatResults: R[] = [];
    for (const result of results) {
      if (result.success && result.result) {
        flatResults.push(...result.result);
      }
    }
    
    return flatResults;
  }

  /**
   * 生产者-消费者模式
   */
  async createProducerConsumer<T, R>(
    producer: () => AsyncGenerator<T>,
    consumer: (item: T) => Promise<R>,
    options?: ConcurrencyOptions & { bufferSize?: number },
  ): Promise<R[]> {
    const maxConcurrent = options?.maxConcurrent || this.maxConcurrentDefault;
    const bufferSize = options?.bufferSize || 1000;
    
    const buffer: T[] = [];
    const results: R[] = [];
    const workers: Promise<void>[] = [];
    
    let producerFinished = false;
    let consumerCount = 0;

    // 生产者
    const producerPromise = (async () => {
      try {
        for await (const item of producer()) {
          buffer.push(item);
          
          // 如果缓冲区满了，等待消费者处理
          while (buffer.length >= bufferSize) {
            await this.delay(10);
          }
        }
      } finally {
        producerFinished = true;
      }
    })();

    // 消费者工作器
    const createConsumerWorker = async (): Promise<void> => {
      while (!producerFinished || buffer.length > 0) {
        const item = buffer.shift();
        if (item === undefined) {
          await this.delay(10);
          continue;
        }

        try {
          const result = await consumer(item);
          results.push(result);
        } catch (error) {
          this.logger.error(`Consumer error: ${error.message}`);
        }
      }
    };

    // 启动消费者
    for (let i = 0; i < maxConcurrent; i++) {
      workers.push(createConsumerWorker());
    }

    // 等待生产者和消费者完成
    await Promise.all([producerPromise, ...workers]);
    
    return results;
  }

  /**
   * 数据流管道处理
   */
  async pipeline<T, R>(
    source: T[],
    stages: Array<(input: any) => Promise<any>>,
    options?: ConcurrencyOptions,
  ): Promise<R[]> {
    let currentData: any[] = source;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      this.logger.debug(`Processing pipeline stage ${i + 1}/${stages.length}`);
      
      // 为每个阶段创建并发任务
      const stageTasks = currentData.map(item => () => stage(item));
      const stageResults = await this.executeConcurrent(stageTasks, options);
      
      // 收集成功的结果
      currentData = stageResults
        .filter(result => result.success)
        .map(result => result.result);
      
      this.logger.debug(`Stage ${i + 1} completed: ${currentData.length} items remaining`);
    }

    return currentData as R[];
  }

  /**
   * 智能负载均衡
   */
  async loadBalance<T, R>(
    tasks: Array<() => Promise<T>>,
    workers: number,
    options?: ConcurrencyOptions,
  ): Promise<TaskResult<T>[]> {
    const workerQueues: Array<Array<() => Promise<T>>> = Array.from(
      { length: workers },
      () => []
    );
    
    // 轮询分配任务
    tasks.forEach((task, index) => {
      workerQueues[index % workers].push(task);
    });

    // 并发执行工作器
    const workerPromises = workerQueues.map(async (queue, workerIndex) => {
      this.logger.debug(`Worker ${workerIndex} processing ${queue.length} tasks`);
      return this.executeConcurrent(queue, options);
    });

    const workerResults = await Promise.all(workerPromises);
    
    // 合并所有工作器的结果
    return workerResults.flat();
  }

  /**
   * 获取队列统计信息
   */
  getStats(): QueueStats {
    const totalTasks = this.stats.completed + this.stats.failed;
    const averageExecutionTime = totalTasks > 0 
      ? this.stats.totalExecutionTime / totalTasks 
      : 0;

    return {
      pending: this.taskQueue.size(),
      running: this.runningTasks.size,
      completed: this.stats.completed,
      failed: this.stats.failed,
      totalTasks,
      averageExecutionTime,
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.taskQueue = new PriorityQueue<() => Promise<any>>();
    this.stats.pending = 0;
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      totalExecutionTime: 0,
    };
  }

  private async worker<T>(
    results: TaskResult<T>[],
    options?: ConcurrencyOptions,
  ): Promise<void> {
    while (!this.taskQueue.isEmpty()) {
      const task = this.taskQueue.dequeue();
      if (!task) break;

      this.stats.pending--;
      this.stats.running++;

      const taskPromise = this.executeWithRetry(task, options);
      this.runningTasks.add(taskPromise);

      try {
        const result = await taskPromise;
        results.push(result);
      } finally {
        this.runningTasks.delete(taskPromise);
        this.stats.running--;
      }
    }
  }

  private async executeWithTimeout<T>(
    task: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      task()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateStats(success: boolean, duration: number): void {
    if (success) {
      this.stats.completed++;
    } else {
      this.stats.failed++;
    }
    
    this.stats.totalExecutionTime += duration;
  }
}
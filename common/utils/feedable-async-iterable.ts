import { DeferredPromise } from '../promise/deferred-promise';
import { AwaitableList } from './collections/awaitable';

export class FeedableAsyncIterable<T> implements AsyncIterable<T> {
  private readonly _read: DeferredPromise;
  private readonly _empty: DeferredPromise;
  private _closed: boolean;
  private buffer: AwaitableList<{ item?: T, error?: Error }>;

  get read(): Promise<void> {
    return this._read;
  }

  get empty(): Promise<void> {
    return this._empty;
  }

  get closed(): boolean {
    return this._closed;
  }

  get bufferSize(): number {
    return this.buffer.size;
  }

  constructor() {
    this._closed = false;
    this.buffer = new AwaitableList();
    this._read = new DeferredPromise();
    this._empty = new DeferredPromise();
  }

  feed(item: T): void {
    if (this.closed) {
      throw new Error('closed');
    }

    this.buffer.append({ item });
  }

  end(): void {
    this._closed = true;
  }

  throw(error: Error): void {
    if (this.closed) {
      throw new Error('closed');
    }

    this.buffer.append({ error });
    this.end();
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    while (!this.closed || this.buffer.size > 0) {
      if (this.buffer.size == 0) {
        await this.buffer.added;
      }

      const out = this.buffer;
      this.buffer = new AwaitableList();

      for (const { item, error } of out) {
        if (error != undefined) {
          throw error;
        }

        yield item as T;
        this._read.resolve();
        this._read.reset();

        if (this.buffer.size == 0) {
          this._empty.resolve();
          this._empty.reset();
        }
      }
    }
  }
}
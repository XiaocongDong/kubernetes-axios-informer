import { KubernetesListObject, ListPromise, ObjectCallback, Watch } from '@kubernetes/client-node'
import { RequestResult } from './webRequest'
import { Cache } from './Cache'

export enum EVENT {
  ADD = 'add',
  UPDATE = 'update',
  DELETE = 'delete',
  ERROR = 'error'
}
type SyncCallback<T> = (items: KubernetesListObject<T>) => void

export class Informer<T> {
  private callbackCache: {[event: string]: Array<ObjectCallback<T>>} = {}
  private syncCallbacks: Array<SyncCallback<T>> = []
  private request: RequestResult|undefined = undefined
  private started: boolean = false
  private resourceVersion: string|undefined = undefined
  
  public cache: Cache<T>|null = null

  public constructor(
    private readonly path: string,
    private readonly watch: Watch,
    private listFn: ListPromise<T>,
    private enableCache: boolean = true
  ) {
    this.callbackCache[EVENT.ADD] = []
    this.callbackCache[EVENT.UPDATE] = []
    this.callbackCache[EVENT.DELETE] = []
    this.callbackCache[EVENT.ERROR] = []
    
    this.syncCallbacks = []

    if (this.enableCache) {
      this.cache = new Cache<T>()
    }
  }

  public async start(): Promise<void> {
    if (this.started) {
      console.warn('informer has already started')
      return
    }

    this.started = true
    await this.doneHandler()
  }

  public stop(): void {
    this.started = false

    if (this.request) {
      this.request.abort()
      this.request = undefined
    }
  }

  private async doneHandler(err?: any) {
    if (err) {
      // handle error to see if it is a 410 GONE error, this needs to recover from resourceVersion
      this.handleError(new Error(`informer failed for ${err}`))
    }

    if (this.request) {
      // abort last request
      this.request.abort()
      this.request = undefined
    }

    const promise = await this.listFn()
    const result = await promise

    const list = result.body
    this.resourceVersion = list.metadata!.resourceVersion

    this.cache && this.cache.syncObjects(list.items)
  
    await this.handleSync(list)

    // informer may have been stopped since the above request is asynchronous
    if (!this.started) {
      return
    }

    this.request = await this.watch.watch(
      this.path,
      { resourceVersion: list.metadata!.resourceVersion},
      this.watchHandler.bind(this),
      this.doneHandler.bind(this)
    )
  }

  private handleError(err) {
    const errorCallbacks = this.callbackCache[EVENT.ERROR] || []
    errorCallbacks.forEach(callback => {
      callback(err)
    })
  }

  private async handleSync(list) {
    try {
      for(let handler of this.syncCallbacks) {
        await handler(list)
      }
    } catch(e) {
      console.error(`Informer call sync callback error for ${e}`)
    }
  }

  private watchHandler(phase: string, obj: T, watchObj?: any): void {
    switch (phase) {
      case 'ADDED':
        this.cache && this.cache.addOrUpdateObject(obj)
        this.handleEvent(EVENT.ADD, obj)
        break
      case 'MODIFIED':
        this.cache && this.cache.addOrUpdateObject(obj)
        this.handleEvent(EVENT.UPDATE, obj)
        break
      case 'DELETED':
        this.cache && this.cache.deleteObject(obj)
        this.handleEvent(EVENT.DELETE, obj)
        break
      case 'BOOKMARK':
        // nothing to do, here for documentation, mostly.
        break
    }
  }

  private handleEvent(event: EVENT, obj: T) {
    const eventHandlers = this.callbackCache[event] || []
    eventHandlers.forEach(async (handler) => {
      try {
        await handler(obj)
      } catch (e) {
        console.error(`informer call callback for ${EVENT} error for : ${e}`)
      }
    })
  }

  on(event: EVENT, handler: (obj: T) => void) {
    const currentHandlers = this.callbackCache[event] || []
    currentHandlers.push(handler)
    this.callbackCache[event] = currentHandlers
  }

  onSync(handler: SyncCallback<T>) {
    this.syncCallbacks.push(handler)
  }
}

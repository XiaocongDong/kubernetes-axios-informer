import { ListPromise, Watch } from '@kubernetes/client-node'
import { RequestResult } from './webRequest'
import { Cache } from './Cache'
import { PassThrough, Transform, TransformOptions } from 'stream'
import { Agent } from 'https'
import * as k8s from '@kubernetes/client-node'
import * as https from 'https'
import axios, { AxiosRequestHeaders } from 'axios'
import EventEmitter = require('events')
import byline = require('byline')

export enum EVENT {
  ADD = 'add',
  UPDATE = 'update',
  DELETE = 'delete',
  ERROR = 'error',
  BOOKMARK = 'bookmark'
}

export class SimpleTransform extends Transform {
  constructor() {
    const options: TransformOptions = { objectMode: true }
    super(options)
  }

  _transform(chunk: any, encoding: any, callback: any) {
    const data = JSON.parse(chunk)
    let phase: EVENT = EVENT.ADD
    switch (data.type) {
      case 'ADDED':
        phase = EVENT.ADD
        break
      case 'MODIFIED':
        phase = EVENT.UPDATE
        break
      case 'DELETED':
        phase = EVENT.DELETE
        break
      case 'BOOKMARK':
        phase = EVENT.BOOKMARK
        break
    }
    this.push({ phase, object: data.object, watchObj: data })
    callback()
  }
}

export class Informer<T> {
  private controller: AbortController = new AbortController()
  events = new EventEmitter()
  stream = new PassThrough({ objectMode: true })
  private request: RequestResult | undefined = undefined
  private started = false
  private resourceVersion: string | undefined = undefined

  public cache: Cache<T> | null = null

  public constructor(
    private readonly path: string,
    private readonly watch: Watch,
    private listFn: ListPromise<T>,
    private enableCache: boolean = true
  ) {
    if (this.enableCache) {
      this.cache = new Cache<T>()
    }
    this.stream.on('data', (watchEvent: any) => {
      this.watchHandler(watchEvent.phase, watchEvent.object, watchEvent.watchObj)
    })
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
    this.controller.abort()
  }

  private makeWatchRequest(kc: k8s.KubeConfig, path: string, output: PassThrough) {
    const cluster = kc.getCurrentCluster()

    const opts: https.RequestOptions = {}

    const params: any = {
      allowWatchBookmarks: true
    }
    params.watch = true

    kc.applytoHTTPSOptions(opts)

    const controller = new AbortController()
    const stream = byline.createStream()
    const simpleTransform = new SimpleTransform()

    const httpsAgent = new Agent({
      keepAlive: true,
      ca: opts.ca,
      cert: opts.cert,
      key: opts.key,
      rejectUnauthorized: opts.rejectUnauthorized
    })

    const url = cluster?.server + '/api/v1/namespaces'

    axios
      .request({
        method: 'GET',
        headers: opts.headers as AxiosRequestHeaders,
        signal: controller.signal,
        url,
        params,
        responseType: 'stream',
        httpsAgent
      })
      .then((response) => {
        response.data.pipe(stream).pipe(simpleTransform).pipe(output, { end: false })
        response.data.once('end', () => {
          httpsAgent.destroy()
        })
      })
      .catch((err) => {
        httpsAgent.destroy()
        console.error(err)
      })
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
    this.resourceVersion = list.metadata?.resourceVersion

    this.cache && this.cache.syncObjects(list.items)

    // informer may have been stopped since the above request is asynchronous
    if (!this.started) {
      return
    }

    const

    this.request = await this.watch.watch(
      this.path,
      { resourceVersion: list.metadata?.resourceVersion },
      this.watchHandler.bind(this),
      this.doneHandler.bind(this)
    )
  }

  private handleError(err) {
    this.events.emit(EVENT.ERROR, err)
  }

  private watchHandler(phase: string, obj: T, watchObj?: any): void {
    switch (phase) {
      case EVENT.ADD:
        this.cache && this.cache.addOrUpdateObject(obj)
        this.events.emit(phase, obj)
        break
      case EVENT.UPDATE:
        this.cache && this.cache.addOrUpdateObject(obj)
        this.events.emit(phase, obj)
        break
      case EVENT.DELETE:
        this.cache && this.cache.deleteObject(obj)
        this.events.emit(phase, obj)
        break
      case 'BOOKMARK':
        // nothing to do, here for documentation, mostly.
        break
    }
  }
}

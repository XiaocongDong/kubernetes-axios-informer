/* eslint-disable no-console */
import { ListPromise } from '@kubernetes/client-node'
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
  private started = false
  private resourceVersion: string | undefined = undefined

  public cache: Cache<T> | null = null

  public constructor(
    private readonly path: string,
    private listFn: ListPromise<T>,
    private kubeConfig: k8s.KubeConfig,
    private enableCache: boolean = true
  ) {
    if (this.enableCache) {
      this.cache = new Cache<T>()
    }
    this.stream.on('data', (watchEvent: any) => {
      this.watchHandler(watchEvent.phase, watchEvent.object, watchEvent.watchObj)
    })
  }

  public start(): void {
    if (this.started) {
      console.warn('informer has already started')
      return
    }

    this.started = true
    console.log('Making watch request')
    this.makeWatchRequest()
    console.log('Fully Started')
  }

  public stop(): void {
    this.started = false
    console.log('Aboring')
    this.controller.abort()
    console.log('aborted')
  }

  private makeWatchRequest(): void {
    const cluster = this.kubeConfig.getCurrentCluster()

    const opts: https.RequestOptions = {}

    const params: any = {
      allowWatchBookmarks: true
    }
    params.watch = true

    this.kubeConfig.applytoHTTPSOptions(opts)

    const stream = byline.createStream()
    const simpleTransform = new SimpleTransform()

    const httpsAgent = new Agent({
      keepAlive: true,
      ca: opts.ca,
      cert: opts.cert,
      key: opts.key,
      rejectUnauthorized: opts.rejectUnauthorized
    })

    const url = cluster?.server + this.path
    this.controller.signal.addEventListener('abort', () => {
      console.log('Abort singal happened!!!')
      httpsAgent.destroy()
    })

    axios
      .request({
        method: 'GET',
        headers: opts.headers as AxiosRequestHeaders,
        signal: this.controller.signal,
        url,
        params,
        responseType: 'stream',
        httpsAgent
      })
      .then((response) => {
        response.data.pipe(stream).pipe(simpleTransform).pipe(this.stream, { end: false })
      })
      .catch((err) => {
        httpsAgent.destroy()
        console.error(err)
      })
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

import { Agent } from 'https'
import axios, { CancelTokenSource, Method } from 'axios'
import fetch from 'node-fetch'
import { OptionsWithUri } from 'request'
import { Duplex, Transform } from 'stream'

class RequestResultStream extends Transform {
  private cancelTokenSource: CancelTokenSource

  constructor(cancelToken: CancelTokenSource, options?) {
    super(options)
    this.cancelTokenSource = cancelToken
  }

  abort() {
    this.cancelTokenSource.cancel()
  }

  _transform(chunk, encoding, done) {
    this.push(chunk, encoding)
    done()
  }
}


// since @kubernetes/client doesn't export RequestResult interface (src/watch)
export interface RequestResult {
  pipe(stream: Duplex): void
  on(ev: string, cb: (arg: any) => void): void
  abort(): void
}

class RequestResultStream extends Transform {
  private cancelTokenSource: CancelTokenSource

  constructor(cancelToken: CancelTokenSource, options?) {
    super(options)
    this.cancelTokenSource = cancelToken
  }

  abort() {
    this.cancelTokenSource.cancel()
  }

  _transform(chunk, encoding, done) {
    this.push(chunk, encoding)
    done()
  }
}

export const webRequest = (opts: OptionsWithUri): RequestResult => {
  const cancelTokenSource = axios.CancelToken.source()
  const requestResultStream = new RequestResultStream(cancelTokenSource)
  //params: opts.qs

  fetch(opts.uri as string, {
    method: opts.method as Method,
    headers: opts.headers,
    agent: new Agent({
      keepAlive: true,
      ca: opts.ca,
      cert: opts.cert,
      key: opts.key,
      rejectUnauthorized: opts.rejectUnauthorized
    })
  })
    .then((response) => {
      response.body?.pipe(requestResultStream)
    })
    .catch((err) => {
      cancelTokenSource.cancel('cancel because of error')
      requestResultStream.emit('error', err)
    })
  // axios
  //   .request({
  //     cancelToken: cancelTokenSource.token,
  //     method: opts.method as Method,
  //     url: opts.uri as string,
  //     params: opts.qs,
  //     responseType: 'stream',
  //     headers: opts.headers,
  //     httpsAgent: new Agent({
  //       keepAlive: true,
  //       ca: opts.ca,
  //       cert: opts.cert,
  //       key: opts.key,
  //       rejectUnauthorized: opts.rejectUnauthorized
  //     })
  //   })
  //   .then((response) => {
  //     response.data.pipe(requestResultStream)
  //   })
  //   .catch((err) => {
  //     cancelTokenSource.cancel('cancel because of error')
  //     requestResultStream.emit('error', err)
  //   })

  return requestResultStream
}

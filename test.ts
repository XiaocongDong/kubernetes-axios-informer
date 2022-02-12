import * as k8s from '@kubernetes/client-node'
import { Agent } from 'https'
import axios, { AxiosRequestHeaders } from 'axios'
import * as https from 'https'
import * as byline from 'byline'

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const cluster = kc.getCurrentCluster()

const opts: https.RequestOptions = {}

const params: any = {
  allowWatchBookmarks: true
}
params.watch = true

kc.applytoHTTPSOptions(opts)

const controller = new AbortController()
const stream = byline.createStream()

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
    response.data.pipe(stream)
    response.data.on('end', function () {
      console.log('finished')
    })
  })
  .catch((err) => {
    console.error(err)
  })

stream.on('data', (line) => {
  try {
    const data = JSON.parse(line)
    console.log({ data })
  } catch (ignore) {
    // ignore parse errors
  }
})

setTimeout(() => {
  console.log('Aboring')
  controller.abort()
  httpsAgent.destroy()
  console.log('Aborted')
}, 10000)
console.log(opts)

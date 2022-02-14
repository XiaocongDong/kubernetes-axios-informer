import * as k8s from '@kubernetes/client-node'
import { Agent } from 'https'
import axios, { AxiosRequestHeaders } from 'axios'
import * as https from 'https'

const kc = new k8s.KubeConfig()
kc.loadFromDefault()

const cluster = kc.getCurrentCluster()

const opts: https.RequestOptions = {}

const container = 'controltowerserver'
const namespace = 'controltower'
const podName = 'controltower-atc-0'

const params: any = {
  follow: true,
  container
}

kc.applytoHTTPSOptions(opts)

const controller = new AbortController()
const httpsAgent = new Agent({
  keepAlive: true,
  ca: opts.ca,
  cert: opts.cert,
  key: opts.key,
  rejectUnauthorized: opts.rejectUnauthorized
})

const url = cluster?.server + `/api/v1/namespaces/${namespace}/pods/${podName}/log`
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
    response.data.pipe(process.stdout)
    response.data.on('end', function () {
      console.log('finished')
    })
  })
  .catch((err) => {
    console.error(err)
  })

// setTimeout(() => {
//   console.log('Aboring')
//   controller.abort()
//   httpsAgent.destroy()
//   console.log('Aborted')
// }, 10000)
console.log(opts)

/* eslint-disable no-console */

import * as k8s from '@kubernetes/client-node'
import { Informer, EVENT } from './Informer'

async function main() {
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()

  const api = kc.makeApiClient(k8s.CoreV1Api)

  const informer = new Informer('/api/v1/namespaces', api.listNamespace, kc, false)
  informer.events.on(EVENT.UPDATE, (event) => {
    console.log({ event })
  })

  informer.start()
  setTimeout(() => {
    console.log('Stopping')
    informer.stop()
    console.log('Stopped')
  }, 10000)
}

main()

import { EVENT, Informer } from './Informer'
import * as k8s from '@kubernetes/client-node'

async function main() {
  const kc = new k8s.KubeConfig()
  kc.loadFromDefault()
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const listFn = () => coreApi.listNamespace()
  const informer = new Informer('/api/v1/namespaces', listFn, kc, false)

  informer.events.on(EVENT.UPDATE, (object: k8s.V1Namespace) => {
    // eslint-disable-next-line no-console
    console.log(`Got and update for ${object?.metadata?.name}`)
  })
  await informer.start()
  setTimeout(async () => {
    // eslint-disable-next-line no-console
    console.log('Stopping the informer')
    informer.stop()
  }, 5000)
}

main()

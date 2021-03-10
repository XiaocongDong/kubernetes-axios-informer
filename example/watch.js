const k8s = require('@kubernetes/client-node')
const { Watch } = require('@kubernetes/client-node')
const { makeInformer, EVENT, webRequest } = require('kubernetes-axios-informer')

const kc = new k8s.KubeConfig()

kc.loadFromDefault()

const k8sApi = kc.makeApiClient(k8s.CoreV1Api)

const listFn = () => k8sApi.listPodForAllNamespaces()

const podId = (pod) => {
  return `name: ${pod.metadata.name} at namespace ${pod.metadata.namespace}`
}

const informer = makeInformer(kc, '/api/v1/pods', listFn)

informer.on(EVENT.ADD, obj => {
  console.log(`add pod ${podId(obj)}`)
})

informer.on(EVENT.UPDATE, obj => {
  console.log(`updated pod ${podId(obj)}`)
})

informer.on(EVENT.DELETE, obj => {
  console.log(`delete pod ${podId(obj)}`)
})

informer.onSync((pods) => {
  console.log('pod has been resynced, update here')
})

informer.start()
  .then(() => {
    console.log('informer is started')
  })

# Kubernetes Axios Informer
An informer implementation based on [`axios`](https://github.com/axios/axios) for [`@kubernetes/client-node`](https://github.com/kubernetes-client/javascript).

## Purpose
We found the following issues with current informer implementation of @kubernetes/client-node(v0.14.0):
* The ongoing request can not be abort, which means connection will hang even if we invoke `informer.stop()` method manually.
* The api of informer is not developer-friendly. Current informer api doesn't have some kind of event like `sync` which will tell us the data in the cache has been `sync` after error in the connection. In some situation like synchronizing data from cluster to external database, the `sync` event is very important because we need to know which data should be deleted from database when it is not in the cluster any more.
* Does not have `SharedInformerFactory` like client-go. `SharedInformer` will share the same underlying cache which will reduce a lot of memory use when you use the informer heavily in your application.

## What is included:
* An different informer with some apis not included in its counterpart implementation of @kubernetes/client-node (DONE)
* A webRequest implementation based on axios for Watch (DONE)
* A SharedInformerFactory for sharing the same informer of the exact same resource of the same cluser (TO DO)

## What is not included
For any other things except the above you want to use to interact with kubernetes cluster, you should use the @kubernetes- node/javascript package.

## Installation
```sh
// since kubernetes-axios-informer is based on @kubernetes/client-node you need to install it first.
npm install @kubernetes/client-node
npm install kubernetes-axios-informer
```
## Example code
### List and watch change of pods resource in the cluster
```javascript
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
```

## APIs
### Informer
#### informer.start()
This method will start a informer which means it will start to list and watch in the cluster. Please note that if current informer has been started, this will be a no-ops.
#### informer.stop()
This method will stop current informer which means no more events will be received.
#### informer.onSync((objects: T[]) => void)
This method will register an event listener for the resync event. Every time after the informer resync resources from the cluster, the registered event listeners will be called.
#### informer.on(EVENT: string, callback)
This method is used to register event listeners for informer, the event can be `ADD`, `UPDATE`, `DELETE` or `ERROR`.
#### informer.cache
This will return the underlying cache object of this informer.

## Cache
### cache.list(namespace?: string)
This method will return all of the objects under a namespace. If namespace is not specified, it will return all of the objects in the cache.
### cache.get(name: string, namespace?: string)
This method will return the first object with the specified namespace and name.
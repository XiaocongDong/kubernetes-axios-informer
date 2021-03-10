import { KubernetesObject } from '@kubernetes/client-node'
import { Cache } from '../Cache'

const pod1 = {
  kind: 'Pod',
  apiVersion: 'v1',
  metadata: {
    name: 'pod1',
    namespace: 'application1',
    resourceVersion: '1'
  }
}

const pod2 = {
  kind: 'Pod',
  apiVersion: 'v1',
  metadata: {
    name: 'pod2',
    namespace: 'application2',
    resourceVersion: '1'
  }
}

const pod3 = {
  kind: 'Pod',
  apiVersion: 'v1',
  metadata: {
    name: 'pod3',
    namespace: 'application2',
    resourceVersion: '1'
  }
}

const pod4 = {
  kind: 'Pod',
  apiVersion: 'v1',
  metadata: {
    name: 'pod4',
    namespace: 'application2',
    resourceVersion: '1'
  }
}

const updatedPod3 = {
  kind: 'Pod',
  apiVersion: 'v1',
  metadata: {
    name: 'pod3',
    namespace: 'application2',
    resourceVersion: '2'
  }
}

describe('Cache', () => {
  let cache: Cache<KubernetesObject>
  let anyCache: any // when test case needs to use private properties/methods of cache, it will call anyCache

  beforeEach(() => {
    cache = new Cache<KubernetesObject>()
    anyCache = cache as any
    anyCache.objects = [pod1, pod2, pod3]
  })
  
  it('should update caches when resync happen', () => {
    const syncObjects = [pod2, pod2, pod3]
    cache.syncObjects(syncObjects)

    expect(anyCache.objects).toBe(syncObjects)
  })

  it('should get all objects when namespace is not specified', () => {
    expect(cache.list()).toEqual([pod1, pod2, pod3])
  })

  it('should get objects under a namespace', () => {
    expect(cache.list('application2')).toEqual([pod2, pod3])
  })

  it('should get object with namespace and name', () => {
    expect(cache.get('pod3', 'application2')).toBe(pod3)
  })

  it('should get undefined when namespace and name not exists in cache', () => {
    expect(cache.get('pod4', 'application2')).toBeUndefined()
  })

  it('should add object when receiving added event', () => {
    cache.addOrUpdateObject(pod4)
    expect(anyCache.objects).toEqual([pod1, pod2, pod3, pod4])
  })

  it('should update object when receiving modified event', () => {
    cache.addOrUpdateObject(updatedPod3)
    expect(anyCache.objects).toEqual([pod1, pod2, updatedPod3])
  })

  it('should delete object when receiving delete event', () => {
    cache.deleteObject(pod3)
    expect(anyCache.objects).toEqual([pod1, pod2])
  })
})

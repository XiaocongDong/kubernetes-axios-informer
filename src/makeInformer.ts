import { KubeConfig, ListPromise } from '@kubernetes/client-node'

import { Informer } from './Informer'

export function makeInformer<T>(
  kubeConfig: KubeConfig,
  path: string,
  listPromiseFn: ListPromise<T>,
  enableCache = true
): Informer<T> {

  const informer = new Informer<T>(path, listPromiseFn, kubeConfig, enableCache)

  return informer
}

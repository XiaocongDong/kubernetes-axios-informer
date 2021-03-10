import { KubeConfig, ListPromise, Watch } from "@kubernetes/client-node"
import { webRequest } from "./webRequest"
import { Informer } from './Informer'

export function makeInformer<T>(
  kubeConfig: KubeConfig,
  path: string,
  listPromiseFn: ListPromise<T>
): Informer<T> {
  const watch = new Watch(kubeConfig, {
    webRequest
  })

  const informer = new Informer<T>(path, watch, listPromiseFn)

  return informer
}

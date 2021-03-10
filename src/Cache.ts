import { KubernetesObject } from "@kubernetes/client-node"

export class Cache<T extends KubernetesObject>{
  private objects: T[] = []

  public list(namespace?: string): ReadonlyArray<T> {
    if (!namespace) {
      return this.objects as ReadonlyArray<T>
    }

    return this.objects.filter(object => object.metadata!.namespace === namespace)
  }

  public get(name: string, namespace?: string) {
    return this.objects.find(object =>
      object.metadata!.name === name && (!namespace || namespace === object.metadata!.namespace)
    )
  }

  public syncObjects(objects: T[]): void {
    this.objects = objects
  }

  public addOrUpdateObject(item: T): void {
    addOrUpdateObject(this.objects, item)
  }

  public deleteObject(object: T): void {
    const index = findKubernetesObject(this.objects, object)
    if (index !== -1) {
      this.objects.splice(index, 1)
    }
  }
}

function addOrUpdateObject<T extends KubernetesObject>(
  objects: T[],
  obj: T
): void {
  const ix = findKubernetesObject(objects, obj)
  if (ix === -1) {
      objects.push(obj)
  } else {
      if (!isSameVersion(objects[ix], obj)) {
          objects[ix] = obj
      }
  }
}

function isSameObject<T extends KubernetesObject>(o1: T, o2: T): boolean {
  return o1.metadata!.name === o2.metadata!.name && o1.metadata!.namespace === o2.metadata!.namespace
}

function isSameVersion<T extends KubernetesObject>(o1: T, o2: T): boolean {
  return (
      o1.metadata!.resourceVersion !== undefined &&
      o1.metadata!.resourceVersion !== null &&
      o1.metadata!.resourceVersion === o2.metadata!.resourceVersion
  )
}

function findKubernetesObject<T extends KubernetesObject>(objects: T[], obj: T): number {
  return objects.findIndex((elt: T) => {
      return isSameObject(elt, obj)
  })
}

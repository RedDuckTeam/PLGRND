import type { NodeActionConfigBase } from './node-action'
import type { HandleConfig } from './node-handle'

export type NodeConfig = {
  label: string
  handles: HandleConfig[]
  actions: NodeActionConfigBase[]
  /** Data keys recomputed at runtime and never persisted or shared (a trailing `*` matches any suffix). */
  transient?: readonly string[]
}

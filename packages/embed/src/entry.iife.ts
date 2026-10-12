// Classic-script entry (Mintlify and plain <script src>): the element shell. `load` is not a window property:
// scripts/assemble-iife.mjs binds it lexically to the lazily evaluated runtime factory around this shell.
import type { RuntimeModule } from './types/runtime-api'
import { define } from './element/define'
import { VERSION } from './version'

declare const load: () => Promise<RuntimeModule>

define({ version: VERSION, eager: false, load })
